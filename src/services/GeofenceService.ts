import * as Location from 'expo-location';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Geofence polygon koordináták (7 taxiállomás)
export interface GeofenceZone {
  polygon: Array<{ lat: number; lng: number }>;
}

export const GEOFENCED_LOCATIONS: Record<string, GeofenceZone> = {
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  'Csillag': {
    polygon: [
      { lat: 47.56202643749776, lng: 19.026920699291967 },
      { lat: 47.56211851588406, lng: 19.02784313279864 },
      { lat: 47.56167285499036, lng: 19.028312536831624 },
      { lat: 47.56148133013577, lng: 19.02726456503706 }
    ]
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

// Callback type for zone status changes
type GeofenceCallback = (locationName: string, isInside: boolean) => void;

/**
 * Singleton GPS Tracking Service
 * Maintains global geofence status for all zones and notifies subscribers of changes
 */
class GeofenceService {
  private static instance: GeofenceService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private zoneStatus: Record<string, boolean> = {};
  private callbacks: GeofenceCallback[] = [];
  private isTracking: boolean = false;

  // Auto-checkout debounce tracking
  private outsideZoneSince: Record<string, number | null> = {};
  private autoCheckoutTimers: Record<string, NodeJS.Timeout | null> = {};
  private readonly AUTO_CHECKOUT_DELAY_MS = 15000; // 15 seconds

  private constructor() {
    // Initialize all zones as "outside" (false)
    Object.keys(GEOFENCED_LOCATIONS).forEach(locationName => {
      this.zoneStatus[locationName] = false;
    });
  }

  public static getInstance(): GeofenceService {
    if (!GeofenceService.instance) {
      GeofenceService.instance = new GeofenceService();
    }
    return GeofenceService.instance;
  }

  /**
   * Start continuous GPS tracking
   * Should be called once on app launch
   */
  public async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('GeofenceService: Already tracking');
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('GeofenceService: Location permission denied');
        return;
      }

      // Start continuous location tracking (matches index.html settings)
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,  // 5 seconds
          distanceInterval: 10, // 10 meters
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      this.isTracking = true;
      console.log('GeofenceService: Started global GPS tracking');
    } catch (error) {
      console.error('GeofenceService: Error starting tracking', error);
    }
  }

  /**
   * Stop GPS tracking
   * Should be called on app termination or logout
   */
  public stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Clear all auto-checkout timers
    Object.keys(this.autoCheckoutTimers).forEach(locationName => {
      if (this.autoCheckoutTimers[locationName]) {
        clearTimeout(this.autoCheckoutTimers[locationName]!);
        this.autoCheckoutTimers[locationName] = null;
      }
    });
    this.outsideZoneSince = {};

    this.isTracking = false;
    console.log('GeofenceService: Stopped GPS tracking and cleared all timers');
  }

  /**
   * Handle GPS position update
   * Checks all zones and notifies subscribers of status changes
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    const userPoint = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };

    // Check ALL geofenced locations (like index.html does)
    Object.keys(GEOFENCED_LOCATIONS).forEach(locationName => {
      const zone = GEOFENCED_LOCATIONS[locationName];
      const wasInside = this.zoneStatus[locationName];
      const isNowInside = isPointInPolygon(userPoint, zone.polygon);

      // Update global status
      this.zoneStatus[locationName] = isNowInside;

      // Notify subscribers if status changed
      if (wasInside !== isNowInside) {
        console.log(`GeofenceService: ${locationName} status changed: ${isNowInside ? 'INSIDE' : 'OUTSIDE'}`);
        this.notifyCallbacks(locationName, isNowInside);

        // Auto-checkout logic: user left zone
        if (wasInside && !isNowInside) {
          console.log(`GeofenceService: User left ${locationName}, starting ${this.AUTO_CHECKOUT_DELAY_MS / 1000}s debounce timer`);
          this.startAutoCheckoutTimer(locationName);
        }

        // Cancel auto-checkout: user returned to zone
        if (!wasInside && isNowInside) {
          console.log(`GeofenceService: User returned to ${locationName}, canceling auto-checkout`);
          this.cancelAutoCheckoutTimer(locationName);
        }
      }
    });
  }

  /**
   * Get current zone status
   * @param locationName - Name of the location/zone
   * @returns true if user is inside the zone, false otherwise
   */
  public getStatus(locationName: string): boolean {
    return this.zoneStatus[locationName] || false;
  }

  /**
   * Subscribe to zone status changes
   * @param callback - Function to call when any zone status changes
   * @returns Unsubscribe function
   */
  public subscribe(callback: GeofenceCallback): () => void {
    this.callbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Start auto-checkout timer for a zone
   * @param locationName - Name of the zone user left
   */
  private startAutoCheckoutTimer(locationName: string): void {
    // Cancel existing timer if any
    this.cancelAutoCheckoutTimer(locationName);

    // Record when user left zone
    this.outsideZoneSince[locationName] = Date.now();

    // Set timer for auto-checkout
    this.autoCheckoutTimers[locationName] = setTimeout(async () => {
      await this.performAutoCheckout(locationName);
    }, this.AUTO_CHECKOUT_DELAY_MS);
  }

  /**
   * Cancel auto-checkout timer for a zone (user returned)
   * @param locationName - Name of the zone
   */
  private cancelAutoCheckoutTimer(locationName: string): void {
    if (this.autoCheckoutTimers[locationName]) {
      clearTimeout(this.autoCheckoutTimers[locationName]!);
      this.autoCheckoutTimers[locationName] = null;
    }
    this.outsideZoneSince[locationName] = null;
  }

  /**
   * Perform auto-checkout after debounce period
   * @param locationName - Name of the zone to checkout from
   */
  private async performAutoCheckout(locationName: string): Promise<void> {
    try {
      // Verify user is still outside (double-check)
      const isStillOutside = this.zoneStatus[locationName] === false;
      if (!isStillOutside) {
        console.log(`GeofenceService: User returned to ${locationName}, skipping auto-checkout`);
        return;
      }

      // Get current user
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.log('GeofenceService: No authenticated user, skipping auto-checkout');
        return;
      }

      // Check if user is in this zone's queue
      const locationRef = doc(db, 'locations', locationName);
      const docSnap = await getDoc(locationRef);

      if (!docSnap.exists()) {
        console.log(`GeofenceService: Location ${locationName} not found in Firebase`);
        return;
      }

      const data = docSnap.data();
      const members = data.members || [];
      const userInZone = members.some((m: any) => m.uid === user.uid);

      if (!userInZone) {
        console.log(`GeofenceService: User not in ${locationName} queue, skipping auto-checkout`);
        return;
      }

      console.log(`🔴 AUTO-CHECKOUT: ${user.uid} from ${locationName} (outside for ${this.AUTO_CHECKOUT_DELAY_MS / 1000}s)`);

      // Remove user from members array
      const updatedMembers = members.filter((m: any) => m.uid !== user.uid);
      await updateDoc(locationRef, { members: updatedMembers });

      // Check if user is V-Osztály and also checkout from V-Osztály queue
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.userType === 'V-Osztály' && locationName !== 'V-Osztály') {
          console.log(`🔴 AUTO-CHECKOUT: ${user.uid} from V-Osztály (dual checkout)`);

          const vClassRef = doc(db, 'locations', 'V-Osztály');
          const vClassSnap = await getDoc(vClassRef);

          if (vClassSnap.exists()) {
            const vClassData = vClassSnap.data();
            const vClassMembers = vClassData.members || [];
            const updatedVClassMembers = vClassMembers.filter((m: any) => m.uid !== user.uid);
            await updateDoc(vClassRef, { members: updatedVClassMembers });
          }
        }
      }

      // Clear timer
      this.autoCheckoutTimers[locationName] = null;
      this.outsideZoneSince[locationName] = null;

    } catch (error) {
      console.error(`GeofenceService: Error during auto-checkout from ${locationName}:`, error);
    }
  }

  /**
   * Notify all subscribers of a zone status change
   */
  private notifyCallbacks(locationName: string, isInside: boolean): void {
    this.callbacks.forEach(callback => {
      try {
        callback(locationName, isInside);
      } catch (error) {
        console.error('GeofenceService: Error in callback', error);
      }
    });
  }

  /**
   * Get tracking status
   */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

// Export singleton instance
export default GeofenceService.getInstance();
