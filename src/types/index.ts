export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  licensePlate: string;
  userType: 'Taxi' | 'Kombi Taxi' | 'VIP' | 'VIP Kombi' | 'V-Osztály';
  status: 'pending' | 'approved';
  role: 'user' | 'admin';
  canSee213?: boolean;
}

export interface LocationMember {
  uid: string;
  username: string;
  userType: string;
  licensePlate: string;
  displayName: string;
}

export interface LocationData {
  members: LocationMember[];
  notes?: string[];
  emiratesMembers?: LocationMember[]; // Only for Reptér
}
