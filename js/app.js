let map;
let markers = {}; // Store markers by store.id: { id: marker }
let userLocation = null;
let stores = [];

// Haversine formula to calculate distance in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Initialize Map
function initMap() {
    // Default center (Kobe Sannomiya)
    map = L.map('map').setView([34.6946, 135.1944], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add listener for map movements
    map.on('moveend', renderStores);

    // Load stores data after map initialization
    loadStores();
}

// Load Stores Data
async function loadStores() {
    try {
        const response = await fetch('data/stores.json');
        stores = await response.json();
        renderStores();
        updateCategoryCounts();
    } catch (error) {
        console.error('Error loading stores:', error);
    }
}

// Highlight a store in the list and scroll to it
function highlightStore(storeId) {
    // Remove highlight from all items
    document.querySelectorAll('.store-item').forEach(item => {
        item.classList.remove('highlight');
    });

    // Add highlight to the selected item
    const targetLi = document.getElementById(`store-${storeId}`);
    if (targetLi) {
        targetLi.classList.add('highlight');
        targetLi.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Check if store is currently open
function isStoreOpen(store) {
    if (!store.business_hours || store.business_hours === 'なし' || store.business_hours === '24時間営業') {
        return true; 
    }

    const now = new Date();
    const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const daysMap = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const todayName = daysMap[day];

    // Check closed days
    if (store.closed_days && store.closed_days !== 'なし' && store.closed_days !== '無し') {
        if (store.closed_days.includes(todayName) || store.closed_days.includes('毎日')) {
            return false;
        }
    }

    // Check business hours (Expects format like "8:30 ～ 19:00" or "11:00～14:30、17:00～21:00")
    try {
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const timeRanges = store.business_hours.split(/[、,]/);
        
        let isOpen = false;
        timeRanges.forEach(range => {
            const times = range.match(/(\d{1,2}):(\d{2})/g);
            if (times && times.length >= 2) {
                const [startH, startM] = times[0].split(':').map(Number);
                const [endH, endM] = times[1].split(':').map(Number);
                
                let startMinutes = startH * 60 + startM;
                let endMinutes = endH * 60 + endM;

                // Handle overnight (e.g., 18:00 ～ 02:00)
                if (endMinutes < startMinutes) {
                    if (currentTime >= startMinutes || currentTime <= endMinutes) {
                        isOpen = true;
                    }
                } else {
                    if (currentTime >= startMinutes && currentTime <= endMinutes) {
                        isOpen = true;
                    }
                }
            } else if (range.includes('24時間')) {
                isOpen = true;
            }
        });

        // If we couldn't parse any times, assume open to be safe
        if (timeRanges.length > 0 && !store.business_hours.match(/\d/)) {
            return true;
        }

        return isOpen || !store.business_hours.match(/\d/); 
    } catch (e) {
        console.warn('Failed to parse business hours for:', store.name, e);
        return true; // Default to open on error
    }
}

// Render Stores on Map and List
function renderStores() {
    const listEl = document.getElementById('store-list');
    listEl.innerHTML = '';
    
    const searchTerm = document.getElementById('search-name').value.toLowerCase();
    const radius = parseInt(document.getElementById('filter-radius').value);
    const cafeChecked = document.getElementById('filter-cafe').checked;
    const restaurantChecked = document.getElementById('filter-restaurant').checked;
    const openOnlyChecked = document.getElementById('filter-open-only').checked;

    const bounds = map.getBounds();

    let filteredStores = stores.filter(store => {
        const matchesName = store.name.toLowerCase().includes(searchTerm);
        const matchesCategory = (store.category === 'カフェ・喫茶店' && cafeChecked) || (store.category === 'レストラン・食堂' && restaurantChecked);
        const matchesOpen = !openOnlyChecked || isStoreOpen(store);
        const matchesBounds = bounds.contains([store.lat, store.lng]);

        if (userLocation) {
            const dist = getDistanceMeters(userLocation.lat, userLocation.lng, store.lat, store.lng);
            store.distance = dist;
            return matchesName && dist <= radius && matchesCategory && matchesOpen && matchesBounds;
        }
        return matchesName && matchesCategory && matchesOpen && matchesBounds;
    });

    if (userLocation) {
        filteredStores.sort((a, b) => a.distance - b.distance);
    }

    document.getElementById('store-count').textContent = `${filteredStores.length}件`;

    if (filteredStores.length === 0) {
        listEl.innerHTML = '<li class="info-msg">該当する店舗が見つかりませんでした。</li>';
        // Remove all markers if no stores are filtered
        Object.keys(markers).forEach(id => {
            map.removeLayer(markers[id]);
            delete markers[id];
        });
        return;
    }

    // DIFFING LOGIC FOR MARKERS
    const filteredStoreIds = new Set(filteredStores.map(s => String(s.id)));

    // 1. Remove markers that are no longer in the filtered list
    Object.keys(markers).forEach(id => {
        if (!filteredStoreIds.has(id)) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });

    filteredStores.forEach(store => {
        const storeId = String(store.id);
        let marker;

        // 2. Add new markers or reuse existing ones
        if (!markers[storeId]) {
            marker = L.marker([store.lat, store.lng])
                .bindPopup(`<b>${store.name}</b><br>${store.category}<br>営業時間: ${store.business_hours || ''}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}" target="_blank">Googleマップで見る</a>`)
                .addTo(map);
            
            marker.on('click', () => {
                highlightStore(store.id);
            });
            markers[storeId] = marker;
        } else {
            marker = markers[storeId];
        }

        // Add List Item (List is still re-rendered completely as it's less expensive than DOM diffing for small lists)
        const li = document.createElement('li');
        li.className = 'store-item';
        li.id = `store-${store.id}`;
        const distStr = store.distance ? `${(store.distance / 1000).toFixed(2)}km` : '';
        
        li.innerHTML = `
            <span class="store-category">${store.category}</span>
            <h3>${store.name}</h3>
            <p class="store-address">${store.address}</p>
            ${store.business_hours ? `<div class="store-meta"><span class="store-distance">営業時間: ${store.business_hours}</span></div>` : ''}
            ${store.official_store_url && store.official_store_url.trim() !== '' ? `<div class="store-meta"><a href="${store.official_store_url}" target="_blank" rel="noopener noreferrer">店舗URL: 公式ページ</a></div>` : ''}
            ${store.closed_days ? `<div class="store-meta"><span class="store-closed">定休日: ${store.closed_days}</span></div>` : ''}
            ${store.note ? `<div class="store-meta"><span class="store-note">備考: ${store.note}</span></div>` : ''}
            <div class="store-meta">
                <span class="store-distance">${distStr}</span>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}" target="_blank" class="btn-gmap">Googleマップ</a>
            </div>
        `;
        li.onclick = () => {
            map.setView([store.lat, store.lng], 18);
            marker.openPopup();
            highlightStore(store.id);
        };
        listEl.appendChild(li);
    });
}

// Get Current Location
function locateUser() {
    if (!navigator.geolocation) {
        alert('お使いのブラウザは位置情報に対応していません。');
        return;
    }

    const btn = document.getElementById('btn-locate');
    btn.disabled = true;
    btn.textContent = '取得中...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Add user marker
            L.circleMarker([userLocation.lat, userLocation.lng], {
                radius: 8,
                fillColor: "#007bff",
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map).bindPopup("現在地").openPopup();
            
            map.setView([userLocation.lat, userLocation.lng], 18);
            
            btn.disabled = false;
            btn.textContent = '現在地を取得（更新）';
            renderStores();
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('位置情報の取得に失敗しました。設定を確認してください。');
            btn.disabled = false;
            btn.textContent = '現在地を取得（更新）';
        },
        { enableHighAccuracy: true }
    );
}

// Update Category Counts
function updateCategoryCounts() {
    const cafeCount = stores.filter(store => store.category === 'カフェ・喫茶店').length;
    const restaurantCount = stores.filter(store => store.category === 'レストラン・食堂').length;

    document.getElementById('cafe-count-display').textContent = ` (${cafeCount})`;
    document.getElementById('restaurant-count-display').textContent = ` (${restaurantCount})`;
}

// Event Listeners
document.getElementById('btn-locate').addEventListener('click', locateUser);
document.getElementById('search-name').addEventListener('input', renderStores);
document.getElementById('filter-radius').addEventListener('change', renderStores);
document.getElementById('filter-cafe').addEventListener('change', renderStores);
document.getElementById('filter-restaurant').addEventListener('change', renderStores);
document.getElementById('filter-open-only').addEventListener('change', renderStores);

// Init
window.onload = () => {
    initMap();
};
