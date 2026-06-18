const map = L.map('map', {
  zoomControl: true
}).setView([-7.98, 112.63], 12);

L.tileLayer(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '&copy; OpenStreetMap', maxZoom: 19 }
).addTo(map);

let sdLayer;
let areaLayerAktif = null;
let jangkauanLayerAktif = null;
let clusterAktif = null;

const mapHint = document.getElementById('mapHint');

const warnaCluster = {
  0: '#e4572e',
  1: '#2563eb',
  2: '#2f9e62',
  3: '#8e5cd9',
  4: '#f5a524'
};

function tampilkanHint(show){
  mapHint.classList.toggle('hidden', !show);
}

Promise.all([
  fetch('data/sd.geojson').then(r => r.json()),
  fetch('data/desa.geojson').then(r => r.json()),
  fetch('data/jalan.geojson').then(r => r.json()),
  fetch('data/jangkauan.geojson').then(r => r.json()),
  fetch('data/area_terlayani.geojson').then(r => r.json())
])

.then(([sd, desa, jalan, jangkauan, area]) => {

  // ======================
  // STATISTIK
  // ======================

  document.getElementById('totalSD').innerHTML = sd.features.length;

  document.getElementById('sdNegeri').innerHTML =
    sd.features.filter(f => f.properties.status_1 === 'Negeri').length;

  document.getElementById('sdSwasta').innerHTML =
    sd.features.filter(f => f.properties.status_1 === 'Swasta').length;

  document.getElementById('totalDesa').innerHTML = desa.features.length;

  const jumlahCluster = new Set(sd.features.map(f => f.properties.CLUSTER_ID)).size;
  document.getElementById('totalCluster').innerHTML = jumlahCluster;

  // ======================
  // RATA RATA PELAYANAN
  // ======================

  let totalPelayanan = 0;
  desa.features.forEach(f => {
    totalPelayanan += Number(f.properties["Clipped_pct terlayani"] || 0);
  });

  const rataPelayanan = (totalPelayanan / desa.features.length).toFixed(2);
  document.getElementById('avgPelayanan').innerHTML = rataPelayanan + '%';

  // ======================
  // KELURAHAN
  // ======================

  const desaLayer = L.geoJSON(desa, {

    style: {
      color: '#94a3b8',
      weight: 1,
      fillColor: '#94a3b8',
      fillOpacity: 0.05
    },

    onEachFeature: (feature, layer) => {
      layer.bindPopup(`
        <div class="popup-desa">
          <div class="popup-title">${feature.properties.WADMKD}</div>
          <div class="popup-body">
            <div class="popup-row"><span class="k">Kecamatan</span><span class="v">${feature.properties.WADMKC}</span></div>
            <div class="popup-row"><span class="k">Terlayani</span><span class="v">${feature.properties["Clipped_pct terlayani"]}%</span></div>
            <div class="popup-row"><span class="k">Kategori</span><span class="v">${feature.properties["Clipped_kategorii"]}</span></div>
          </div>
        </div>
      `);
    }

  }).addTo(map);

  // ======================
  // JALAN
  // ======================

  const jalanLayer = L.geoJSON(jalan, {
    style: {
      color: '#c2c7d0',
      weight: 0.8
    }
  }).addTo(map);

  // ======================
  // CLUSTER INTERAKTIF
  // ======================

  function tutupCluster(){

    if (areaLayerAktif) {
      map.removeLayer(areaLayerAktif);
      areaLayerAktif = null;
    }

    if (jangkauanLayerAktif) {
      map.removeLayer(jangkauanLayerAktif);
      jangkauanLayerAktif = null;
    }

    clusterAktif = null;
    tampilkanHint(false);
  }

  function tampilCluster(clusterId){

    // jika klik cluster yang sama, toggle tutup
    if (String(clusterAktif) === String(clusterId)) {
      tutupCluster();
      return;
    }

    if (areaLayerAktif) map.removeLayer(areaLayerAktif);
    if (jangkauanLayerAktif) map.removeLayer(jangkauanLayerAktif);

    areaLayerAktif = L.geoJSON(area, {
      filter: f => String(f.properties.CLUSTER_ID) === String(clusterId),
      style: {
        color: '#f5a524',
        weight: 1,
        fillColor: '#fbbf24',
        fillOpacity: 0.22
      }
    }).addTo(map);

    areaLayerAktif.bringToBack();
    jalanLayer.bringToBack();
    desaLayer.bringToBack();

    jangkauanLayerAktif = L.geoJSON(jangkauan, {
      filter: f => String(f.properties.CLUSTER_ID) === String(clusterId),
      style: {
        color: '#dc2626',
        weight: 1.6,
        opacity: 0.85
      }
    }).addTo(map);

    clusterAktif = clusterId;
    tampilkanHint(true);
  }

  // klik di area kosong peta -> reset ke tampilan awal
  map.on('click', () => {
    tutupCluster();
  });

  // ======================
  // SD
  // ======================

  function buatLayerSD(data){

    return L.geoJSON(data, {

      pointToLayer: (feature, latlng) => {

        const warna = warnaCluster[feature.properties.CLUSTER_ID] || '#475569';

        return L.circleMarker(latlng, {
          radius: 4.5,
          fillColor: warna,
          fillOpacity: 1,
          color: '#ffffff',
          weight: 1
        });

      },

      onEachFeature: (feature, layer) => {

        const p = feature.properties;
        const statusClass = p.status_1 === 'Negeri' ? 'negeri' : 'swasta';

        layer.bindPopup(`
          <div class="popup-sd">
            <div class="popup-head">
              <div class="popup-title">${p.remark}</div>
              <span class="popup-badge ${statusClass}">${p.status_1 || '-'}</span>
            </div>
            <div class="popup-body">
              <div class="popup-row"><span class="k">Alamat</span><span class="v">${p.alamat_1 || '-'}</span></div>
              <div class="popup-row"><span class="k">Cluster</span><span class="v">${p.CLUSTER_ID}</span></div>
              <div class="popup-row"><span class="k">Ukuran cluster</span><span class="v">${p.CLUSTER_SIZE} SD</span></div>
              <div class="popup-foot">Klik titik ini lagi untuk menutup area layanan.</div>
            </div>
          </div>
        `);

        // klik titik SD -> tampilkan cluster, jangan biarkan event "bubbling" ke map (yang akan reset)
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          tampilCluster(p.CLUSTER_ID);
        });

      }

    });

  }

  sdLayer = buatLayerSD(sd);
  sdLayer.addTo(map);

  // ======================
  // SEARCH
  // ======================

  document.getElementById('searchInput').addEventListener('keyup', function(){

    const keyword = this.value.toLowerCase();

    sdLayer.eachLayer(layer => {

      const nama = (layer.feature.properties.remark || '').toLowerCase();

      if (keyword && nama.includes(keyword)) {
        layer.setStyle({ radius: 7, weight: 2 });
        layer.openPopup();
      } else {
        layer.setStyle({ radius: 4.5, weight: 1 });
      }

    });

  });

  // ======================
  // FILTER
  // ======================

  document.getElementById('statusFilter').addEventListener('change', function(){

    const status = this.value;

    map.removeLayer(sdLayer);

    const hasil = {
      type: 'FeatureCollection',
      features: sd.features.filter(f => status === 'all' ? true : f.properties.status_1 === status)
    };

    sdLayer = buatLayerSD(hasil);
    sdLayer.addTo(map);

  });

  // ======================
  // LAYER CONTROL
  // ======================

  L.control.layers(
    {},
    {
      'Kelurahan': desaLayer,
      'Jalan': jalanLayer
    },
    { collapsed: false }
  ).addTo(map);

  // ======================
  // CHART DEFAULTS (selaraskan dengan tema)
  // ======================

  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#5b6470';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;

  const paletteCluster = ['#e4572e', '#2563eb', '#2f9e62', '#8e5cd9', '#f5a524'];

  // ======================
  // CHART STATUS
  // ======================

  new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
      labels: ['Negeri', 'Swasta'],
      datasets: [{
        data: [
          sd.features.filter(f => f.properties.status_1 === 'Negeri').length,
          sd.features.filter(f => f.properties.status_1 === 'Swasta').length
        ],
        backgroundColor: ['#2563eb', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      cutout: '65%'
    }
  });

  // ======================
  // CHART CLUSTER
  // ======================

  const clusterCount = {};
  sd.features.forEach(f => {
    const c = f.properties.CLUSTER_ID;
    clusterCount[c] = (clusterCount[c] || 0) + 1;
  });

  new Chart(document.getElementById('chartCluster'), {
    type: 'bar',
    data: {
      labels: Object.keys(clusterCount).map(c => 'Cluster ' + c),
      datasets: [{
        label: 'Jumlah SD',
        data: Object.values(clusterCount),
        backgroundColor: Object.keys(clusterCount).map(c => paletteCluster[c % paletteCluster.length]),
        borderRadius: 6,
        maxBarThickness: 28
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#eef0f3' }, beginAtZero: true }
      }
    }
  });

  // ======================
  // TOP 10 KELURAHAN
  // ======================

  const topKelurahan = desa.features
    .map(f => ({
      nama: f.properties.WADMKD,
      nilai: Number(f.properties["Clipped_pct terlayani"])
    }))
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 10);

  new Chart(document.getElementById('chartKelurahan'), {
    type: 'bar',
    data: {
      labels: topKelurahan.map(d => d.nama),
      datasets: [{
        label: '% Terlayani',
        data: topKelurahan.map(d => d.nilai),
        backgroundColor: '#2563eb',
        borderRadius: 5,
        maxBarThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#eef0f3' }, beginAtZero: true },
        y: { grid: { display: false } }
      }
    }
  });

  // ======================
  // KATEGORI
  // ======================

  const kategori = {};
  desa.features.forEach(f => {
    const k = f.properties["Clipped_kategorii"];
    kategori[k] = (kategori[k] || 0) + 1;
  });

  new Chart(document.getElementById('chartKategori'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(kategori),
      datasets: [{
        data: Object.values(kategori),
        backgroundColor: ['#2563eb', '#2f9e62', '#f5a524', '#e4572e', '#8e5cd9'],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      cutout: '60%'
    }
  });

  map.fitBounds(desaLayer.getBounds());

})

.catch(err => {
  console.error(err);
  alert('Gagal memuat GeoJSON. Periksa console untuk detail.');
});
