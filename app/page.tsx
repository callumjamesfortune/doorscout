'use client';

import React, { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    tt: any;
  }
}

const HouseNumberMap: React.FC = () => {
  const [following, setFollowing] = useState(true);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const isInitialised = useRef(false);
  const latestPosition = useRef<[number, number] | null>(null);
  const locationWatchId = useRef<number | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.12.0/maps/maps-web.min.js';
    script.async = true;

    script.onload = () => {
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_KEY;

      function initHouseNumberMap() {
        const map = window.tt.map({
          key: apiKey,
          container: 'map1',
          center: [-2.4405, 53.0997],
          zoom: 18,
          style: `https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAOW5lSkQ4U0x1S0lWT0c4ajs4MzUyZGI3MC00YjBjLTQxZjgtOTQ1Yi03NWZmYjJmN2MyMDM=.json?key=${apiKey}`,
          dragPan: false,
          scrollZoom: false,
          touchZoomRotate: false,
        });

        mapRef.current = map;

        // Create the fixed centre marker
        const marker = document.createElement('div');
        marker.className = 'marker-circle-fixed';
        document.getElementById('map1')?.appendChild(marker);
        markerRef.current = marker;

        if (navigator.geolocation) {
          locationWatchId.current = navigator.geolocation.watchPosition(updateUserLocation, showError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        }
      }

      function updateUserLocation(position: GeolocationPosition) {
        const userCoordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
        latestPosition.current = userCoordinates;

        // Only centre on first fix if following was initially enabled
        if (!isInitialised.current && following && mapRef.current) {
          mapRef.current.setCenter(userCoordinates);
          isInitialised.current = true;
        }
      }

      function showError(error: GeolocationPositionError) {
        console.error("Error retrieving location: ", error.message);
        alert("Unable to retrieve your location. Please enable location services.");
      }

      initHouseNumberMap();
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (mapRef.current) mapRef.current.remove();
      if (locationWatchId.current !== null) navigator.geolocation.clearWatch(locationWatchId.current);
    };
  }, []);

  // Handle map interaction toggle
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    map.scrollZoom[following ? 'disable' : 'enable']();
    map.dragPan[following ? 'disable' : 'enable']();
    map.touchZoomRotate[following ? 'disable' : 'enable']();

    // Show or hide the fixed marker
    if (markerRef.current) {
      markerRef.current.style.display = following ? 'block' : 'none';
    }

    // Recenter on user when switching back to following mode
    if (following && latestPosition.current) {
      map.setCenter(latestPosition.current);
      map.setZoom(18);
    }
  }, [following]);

  // Periodically recenter the map if following is enabled
  useEffect(() => {
    const interval = setInterval(() => {
      if (following && mapRef.current && latestPosition.current) {
        mapRef.current.setCenter(latestPosition.current);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [following]);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <nav className="bg-black h-20 text-white text-[1.5em] font-bold flex items-center justify-between px-6">
        <span>DoorScout</span>
        <button
          onClick={() => setFollowing((prev) => !prev)}
          className="bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-300 transition"
        >
          {following ? 'Explore' : 'Track'}
        </button>
      </nav>
      <div id="map1" className="w-full flex-grow relative">
        <style>{`
          .marker-circle-fixed {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30px;
            height: 30px;
            margin-left: -15px;
            margin-top: -15px;
            background-color: yellow;
            border: 3px solid black;
            border-radius: 50%;
            z-index: 10;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default HouseNumberMap;
