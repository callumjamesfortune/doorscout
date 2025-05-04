'use client';

import React, { useEffect } from 'react';

declare global {
  interface Window {
    tt: any;
  }
}

const HouseNumberMap: React.FC = () => {
  useEffect(() => {
    // Dynamically load the TomTom script
    const script = document.createElement('script');
    script.src = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.12.0/maps/maps-web.min.js';
    script.async = true;
    script.onload = () => {
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_KEY;
      let map1: any;
      let userMarker: any;
      let currentHeading = 0;
      let userCoordinates: [number, number] | null = null;
      let isSearching = false;

      function initHouseNumberMap() {
        map1 = window.tt.map({
          key: apiKey,
          container: 'map1',
          center: [-2.4405, 53.0997],
          zoom: 18,
          style: `https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAOW5lSkQ4U0x1S0lWT0c4ajs4MzUyZGI3MC00YjBjLTQxZjgtOTQ1Yi03NWZmYjJmN2MyMDM=.json?key=${apiKey}`,
        });

        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(updateUserLocation, showError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        }
      }

      function updateUserLocation(position: GeolocationPosition) {
        userCoordinates = [position.coords.longitude, position.coords.latitude];

        if (!userMarker) {
          userMarker = new window.tt.Marker({ element: createMarker() }).setLngLat(userCoordinates).addTo(map1);
        } else {
          userMarker.setLngLat(userCoordinates);
        }

        if (!isSearching) {
          map1.setCenter(userCoordinates);
          map1.setBearing(currentHeading);
        }
      }

      function createMarker() {
        const markerElement = document.createElement('div');
        markerElement.className = 'marker-circle';
        markerElement.style.width = '30px';
        markerElement.style.height = '30px';
        markerElement.style.backgroundColor = 'yellow';
        markerElement.style.borderRadius = '50%';
        markerElement.style.border = '3px solid black';
        return markerElement;
      }

      function showError(error: GeolocationPositionError) {
        console.error("Error retrieving location: ", error.message);
        alert("Unable to retrieve your location. Please enable location services.");
      }

      initHouseNumberMap();

      return () => {
        // Clean up when the component is unmounted
        if (map1) {
          map1.remove();
        }
      };
    };

    document.body.appendChild(script);

    return () => {
      // Clean up script on unmount
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="w-full flex flex-col overflow-hidden">
      <nav className="bg-black h-20 text-white text-[2em] font-bold grid place-content-center">
        <span>DoorScout</span>
      </nav>
      <div id="map1" className="w-full h-[100vh]"></div>
    </div>
  );
};

export default HouseNumberMap;
