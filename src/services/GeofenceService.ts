// Geofence polygon koordináták (7 taxiállomás)
export interface GeofenceZone {
  polygon: Array<{ lat: number; lng: number }>;
  isInside: boolean;
}

export const geofencedLocations: Record<string, GeofenceZone> = {
  'Akadémia': {
    polygon: [
      { lat: 47.505695, lng: 19.049845 },
      { lat: 47.506827, lng: 19.049527 },
      { lat: 47.507495, lng: 19.055352 },
      { lat: 47.497514, lng: 19.055229 },
      { lat: 47.496632, lng: 19.049139 },
      { lat: 47.492195, lng: 19.051646 },
      { lat: 47.491865, lng: 19.050269 },
      { lat: 47.497717, lng: 19.046456 },
      { lat: 47.505254, lng: 19.044161 }
    ],
    isInside: false
  },
  'Belváros': {
    polygon: [
      { lat: 47.492765, lng: 19.053449 },
      { lat: 47.494664, lng: 19.060327 },
      { lat: 47.491990, lng: 19.061735 },
      { lat: 47.489962, lng: 19.062238 },
      { lat: 47.486635, lng: 19.062418 },
      { lat: 47.484643, lng: 19.058464 },
      { lat: 47.489574, lng: 19.052048 },
      { lat: 47.492889, lng: 19.049281 },
      { lat: 47.493860, lng: 19.052686 }
    ],
    isInside: false
  },
  'Conti': {
    polygon: [
      { lat: 47.504349, lng: 19.067239 },
      { lat: 47.501800, lng: 19.069939 },
      { lat: 47.503799, lng: 19.073626 },
      { lat: 47.503075, lng: 19.074569 },
      { lat: 47.498615, lng: 19.073754 },
      { lat: 47.493633, lng: 19.077012 },
      { lat: 47.492301, lng: 19.070495 },
      { lat: 47.492040, lng: 19.060766 },
      { lat: 47.495487, lng: 19.058537 },
      { lat: 47.497949, lng: 19.054250 },
      { lat: 47.501829, lng: 19.061152 }
    ],
    isInside: false
  },
  'Budai': {
    polygon: [
      { lat: 47.517476, lng: 19.040136 },
      { lat: 47.512301, lng: 19.040825 },
      { lat: 47.501449, lng: 19.041084 },
      { lat: 47.496714, lng: 19.043184 },
      { lat: 47.489582, lng: 19.048970 },
      { lat: 47.485264, lng: 19.054092 },
      { lat: 47.484386, lng: 19.052588 },
      { lat: 47.487757, lng: 19.048762 },
      { lat: 47.491265, lng: 19.042955 },
      { lat: 47.493435, lng: 19.037831 },
      { lat: 47.496528, lng: 19.032161 },
      { lat: 47.501190, lng: 19.023484 },
      { lat: 47.504882, lng: 19.023689 },
      { lat: 47.508021, lng: 19.021229 },
      { lat: 47.508159, lng: 19.025670 },
      { lat: 47.510513, lng: 19.029359 },
      { lat: 47.512128, lng: 19.034074 },
      { lat: 47.516511, lng: 19.036055 },
      { lat: 47.517527, lng: 19.036123 }
    ],
    isInside: false
  },
  'Crowne': {
    polygon: [
      { lat: 47.526947, lng: 19.054402 },
      { lat: 47.524934, lng: 19.063909 },
      { lat: 47.517542, lng: 19.074701 },
      { lat: 47.505532, lng: 19.055738 },
      { lat: 47.504976, lng: 19.047721 },
      { lat: 47.509246, lng: 19.044072 },
      { lat: 47.517785, lng: 19.047875 }
    ],
    isInside: false
  },
  'Kozmo': {
    polygon: [
      { lat: 47.493255, lng: 19.067396 },
      { lat: 47.494823, lng: 19.077291 },
      { lat: 47.489935, lng: 19.080590 },
      { lat: 47.490581, lng: 19.090439 },
      { lat: 47.486707, lng: 19.092372 },
      { lat: 47.484232, lng: 19.075017 },
      { lat: 47.486569, lng: 19.074971 },
      { lat: 47.486615, lng: 19.067396 }
    ],
    isInside: false
  },
  'Reptér': {
    polygon: [
      { lat: 47.419958, lng: 19.244589 },
      { lat: 47.417475, lng: 19.251907 },
      { lat: 47.418049, lng: 19.255322 },
      { lat: 47.415881, lng: 19.261834 },
      { lat: 47.412867, lng: 19.259522 },
      { lat: 47.415307, lng: 19.251631 },
      { lat: 47.415508, lng: 19.246541 },
      { lat: 47.417676, lng: 19.243253 }
    ],
    isInside: false
  }
};

// Point in Polygon algoritmus (Ray casting)
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  const x = point.lat;
  const y = point.lng;
  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}

// Ellenőrzi hogy a user melyik zónában van
export function checkUserInZones(
  userLocation: { lat: number; lng: number }
): string | null {
  for (const [locationName, zone] of Object.entries(geofencedLocations)) {
    if (isPointInPolygon(userLocation, zone.polygon)) {
      return locationName;
    }
  }
  return null;
}
