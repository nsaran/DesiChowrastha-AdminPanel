import React, { createContext, useState, useEffect, useCallback } from "react";
import { auth } from '../config/firebase';

export const AuthContext = createContext();

/**
 * AuthProvider handles Firebase authentication state and custom claims (role, restaurantId).
 * 
 * Key design decisions:
 * - `loading` is true until the FIRST auth check completes (including claims fetch)
 * - After initial load, `loading` stays false — subsequent auth changes update state in place
 * - This prevents flickering/redirects on every auth state change
 * - `refreshClaims()` is exposed for login pages to force a token refresh after sign-in
 */
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [role, setRole] = useState(null);
    const [assignedRestaurant, setAssignedRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    // Fetch claims from the current user's token
    const fetchClaims = useCallback(async (user) => {
        if (!user) {
            setRole(null);
            setAssignedRestaurant(null);
            return;
        }
        try {
            const tokenResult = await user.getIdTokenResult(true);
            setRole(tokenResult.claims.role || null);
            setAssignedRestaurant(tokenResult.claims.restaurantId || null);
        } catch (error) {
            console.error('Error fetching claims:', error);
            setRole(null);
            setAssignedRestaurant(null);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            await fetchClaims(user);

            // Only set loading false on the first auth check
            if (!initialLoadDone) {
                setInitialLoadDone(true);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [fetchClaims, initialLoadDone]);

    /**
     * Call this after sign-in to force refresh claims before navigating.
     * Returns { role, assignedRestaurant } so the caller can make decisions.
     */
    const refreshClaims = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return { role: null, assignedRestaurant: null };

        const tokenResult = await user.getIdTokenResult(true);
        const newRole = tokenResult.claims.role || null;
        const newRestaurant = tokenResult.claims.restaurantId || null;

        setCurrentUser(user);
        setRole(newRole);
        setAssignedRestaurant(newRestaurant);

        return { role: newRole, assignedRestaurant: newRestaurant };
    }, []);

    // Helper to get fresh ID token for API calls
    const getToken = useCallback(async () => {
        const user = auth.currentUser;
        if (user) {
            return await user.getIdToken();
        }
        return null;
    }, []);

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                role,
                assignedRestaurant,
                loading,
                getToken,
                refreshClaims
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
