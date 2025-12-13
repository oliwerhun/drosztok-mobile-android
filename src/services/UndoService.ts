import { LocationMember } from './LocationScreen';

export interface CheckoutState {
    locationName: string;
    memberData: LocationMember;
    index: number;
    memberType: 'members' | 'emiratesMembers';
    vClassCheckout?: {
        locationName: string;
        memberData: LocationMember;
        index: number;
    };
}

class UndoService {
    private lastCheckedOut: CheckoutState | null = null;

    setLastCheckedOut(state: CheckoutState | null) {
        this.lastCheckedOut = state;
    }

    getLastCheckedOut(): CheckoutState | null {
        return this.lastCheckedOut;
    }

    clear() {
        this.lastCheckedOut = null;
    }
}

export const undoService = new UndoService();
