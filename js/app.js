let map;
let markers = [];
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

    // Load stores data after map initialization
    loadStores();
}

// Load Stores Data
async function loadStores() {
    try {
        const response = await fetch('data/stores.json');
        stores = await response.json();
        renderStores();
    } catch (error) {
        console.error('Error loading stores:', error);
    }
}

// Render Stores on Map and List
function renderStores() {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    const listEl = document.getElementById('store-list');
    listEl.innerHTML = '';
    
    const searchTerm = document.getElementById('search-name').value.toLowerCase();
    const radius = parseInt(document.getElementById('filter-radius').value);
    const cafeChecked = document.getElementById('filter-cafe').checked;
    const restaurantChecked = document.getElementById('filter-restaurant').checked;

    let filteredStores = stores.filter(store => {
        const matchesName = store.name.toLowerCase().includes(searchTerm);
        if (userLocation) {
            const dist = getDistanceMeters(userLocation.lat, userLocation.lng, store.lat, store.lng);
            store.distance = dist;
            return matchesName && dist <= radius && (cafeChecked || restaurantChecked) && ((store.category === 'カフェ・喫茶店' && cafeChecked) || (store.category === 'レストラン・食堂' && restaurantChecked));
        }
        return matchesName && (cafeChecked || restaurantChecked) && ((store.category === 'カフェ・喫茶店' && cafeChecked) || (store.category === 'レストラン・食堂' && restaurantChecked));
    });

    if (userLocation) {
        filteredStores.sort((a, b) => a.distance - b.distance);
    }

    document.getElementById('store-count').textContent = `${filteredStores.length}件`;

    if (filteredStores.length === 0) {
        listEl.innerHTML = '<li class="info-msg">該当する店舗が見つかりませんでした。</li>';
        return;
    }

    filteredStores.forEach(store => {
        // Add Marker
        const marker = L.marker([store.lat, store.lng])
            .bindPopup(`<b>${store.name}</b><br>${store.category}<br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}" target="_blank">Googleマップで見る</a>`)
            .addTo(map);
        markers.push(marker);

        // Add List Item
        const li = document.createElement('li');
        li.className = 'store-item';
        const distStr = store.distance ? `${(store.distance / 1000).toFixed(2)}km` : '';
        
        li.innerHTML = `
            <span class="store-category">${store.category}</span>
            <h3>${store.name}</h3>
            <p class="store-address">${store.address}</p>
            <div class="store-meta">
                <span class="store-distance">${distStr}</span>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}" target="_blank" class="btn-gmap">Googleマップ</a>
            </div>
        `;
        li.onclick = () => {
            map.setView([store.lat, store.lng], 16);
            marker.openPopup();
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
            
            map.setView([userLocation.lat, userLocation.lng], 15);
            
            btn.disabled = false;
            btn.textContent = '現在地を取得';
            renderStores();
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('位置情報の取得に失敗しました。設定を確認してください。');
            btn.disabled = false;
            btn.textContent = '現在地を取得';
        },
        { enableHighAccuracy: true }
    );
}

// Event Listeners
document.getElementById('btn-locate').addEventListener('click', locateUser);
document.getElementById('search-name').addEventListener('input', renderStores);
document.getElementById('filter-radius').addEventListener('change', renderStores);
document.getElementById('filter-cafe').addEventListener('change', renderStores);
document.getElementById('filter-restaurant').addEventListener('change', renderStores);

// Init
window.onload = () => {
    initMap();
};
