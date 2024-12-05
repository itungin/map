import { map } from "./config/peta.js";
import VectorLayer from "https://cdn.skypack.dev/ol/layer/Vector.js";
import VectorSource from "https://cdn.skypack.dev/ol/source/Vector.js";
import Point from "https://cdn.skypack.dev/ol/geom/Point.js";
import Feature from "https://cdn.skypack.dev/ol/Feature.js";
import GeoJSON from "https://cdn.skypack.dev/ol/format/GeoJSON.js";
import { toLonLat } from "https://cdn.skypack.dev/ol/proj.js";
import { Style, Stroke, Icon, Fill } from "https://cdn.skypack.dev/ol/style.js";

// Sources and layers
const roadsSource = new VectorSource();
const markerSource = new VectorSource();
const polygonSource = new VectorSource();

const roadsLayer = new VectorLayer({
  source: roadsSource,
  style: new Style({
    stroke: new Stroke({
      color: "black",
      width: 4,
    }),
  }),
});
const markerLayer = new VectorLayer({
  source: markerSource,
  style: new Style({
    image: new Icon({
      src:
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(` 
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
          <path fill="red" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 10.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>`),
      scale: 1,
      anchor: [0.5, 1],
    }),
  }),
});
const polygonLayer = new VectorLayer({
  source: polygonSource,
  style: new Style({
    fill: new Fill({
      color: "rgba(165, 163, 164, 0.59)", // Warna arsiran (biru transparan)
    }),
    stroke: new Stroke({
      color: "gray",
      width: 2,
    }),
  }),
});

map.addLayer(roadsLayer);
map.addLayer(markerLayer);
map.addLayer(polygonLayer);

let clickedCoordinates = null; // Global variable to store clicked coordinates

// Event handler for map clicks
map.on("click", async (event) => {
  const coordinates = event.coordinate;
  const [longitude, latitude] = toLonLat(coordinates);

  console.log(`Longitude: ${longitude}, Latitude: ${latitude}`);
  clickedCoordinates = [longitude, latitude]; // Save the clicked coordinates

  // Store coordinates in localStorage
  localStorage.setItem("longitude", longitude);
  localStorage.setItem("latitude", latitude);

  // Add marker
  addMarker(coordinates);
});

// Event listener for "Hitung" button
document.getElementById("btn-distance").addEventListener("click", async () => {
  const distanceInput = document.getElementById("distance-input").value;

  if (!distanceInput || isNaN(distanceInput) || Number(distanceInput) <= 0) {
    alert("Masukkan jarak yang valid (angka positif)!");
    return;
  }

  if (!clickedCoordinates) {
    alert("Silakan pilih lokasi di peta terlebih dahulu!");
    return;
  }

  const maxDistance = Number(distanceInput);

  // Fetch and display roads
  const [longitude, latitude] = clickedCoordinates;
  const roadsData = await fetchRoads(longitude, latitude, maxDistance);
  if (roadsData) {
    const geoJSON = convertToGeoJSON(roadsData);
    displayRoads(geoJSON);
  }
});

// Region
document.getElementById("regionSearch").addEventListener("click", async () => {
  const longitude = localStorage.getItem("longitude");
  const latitude = localStorage.getItem("latitude");

  if (longitude && latitude) {
    // Clear previous roads before displaying region
    roadsSource.clear();

    // Fetch GeoJSON from API
    const geoJSON = await fetchRegionGeoJSON(longitude, latitude);
    if (geoJSON) {
      displayPolygonOnMap(geoJSON); // Display polygon from GeoJSON
    } else {
      alert("Failed to fetch region data. Please try again.");
    }

    // Fetch properties for the region
    try {
      const response = await fetch("https://asia-southeast2-awangga.cloudfunctions.net/itungin/region", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          long: longitude,
          lat: latitude,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data); // Debugging

      // Store properties in localStorage
      if (data.features && data.features.length > 0) {
        const properties = data.features[0].properties;

        // Store properties in localStorage
        localStorage.setItem("district", properties.district || "N/A");
        localStorage.setItem("province", properties.province || "N/A");
        localStorage.setItem("sub_district", properties.sub_district || "N/A");
        localStorage.setItem("village", properties.village || "N/A");

        // Display properties in UI
        document.getElementById("district").textContent = properties.district || "N/A";
        document.getElementById("province").textContent = properties.province || "N/A";
        document.getElementById("sub-district").textContent = properties.sub_district || "N/A";
        document.getElementById("village").textContent = properties.village || "N/A";
      } else {
        alert("Data tidak ditemukan untuk lokasi ini.");
      }
    } catch (error) {
      console.error("Error fetching region data:", error);
      alert("Terjadi kesalahan saat mengambil data daerah.");
    }
  } else {
    alert("Please click on the map to select a region.");
  }
});

// Function to fetch roads
async function fetchRoads(longitude, latitude, maxDistance) {
  try {
    const response = await fetch("https://asia-southeast2-awangga.cloudfunctions.net/itungin/roads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        long: longitude,
        lat: latitude,
        max_distance: maxDistance,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching roads:", error);
    return null;
  }
}

// Function to display roads
function displayRoads(geoJSON) {
  const format = new GeoJSON();
  const features = format.readFeatures(geoJSON, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });

  roadsSource.clear(); // Clear previous roads
  roadsSource.addFeatures(features); // Add new roads
}

async function fetchRegionGeoJSON(longitude, latitude) {
  try {
    const response = await fetch("https://asia-southeast2-awangga.cloudfunctions.net/itungin/region", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        long: longitude,
        lat: latitude,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GeoJSON region:", error);
    return null;
  }
}

// Function to display polygon on map
function displayPolygonOnMap(geoJSON) {
  const features = new GeoJSON().readFeatures(geoJSON, {
    dataProjection: "EPSG:4326", // GeoJSON projection
    featureProjection: "EPSG:3857", // Map projection
  });

  polygonSource.clear(); // Clear previous polygons
  polygonSource.addFeatures(features); // Add new features

  if (features.length > 0) {
    const extent = polygonSource.getExtent();
    map.getView().fit(extent, { padding: [50, 50, 50, 50] });
  } else {
    alert("No region data found.");
  }
}

// Function to add marker
function addMarker(coordinate) {
  const marker = new Feature({
    geometry: new Point(coordinate),
  });

  markerSource.clear(); // Clear previous markers
  markerSource.addFeature(marker); // Add new marker
}

// Function to convert response to GeoJSON
function convertToGeoJSON(response) {
  return {
    type: "FeatureCollection",
    features: response.map((road) => ({
      type: "Feature",
      geometry: road.geometry,
      properties: road.properties,
    })),
  };
}
