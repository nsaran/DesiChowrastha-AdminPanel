import React, { createContext, useState, useEffect } from "react";
import { auth } from '../config/firebase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // this is a listener which is triggered on authentication state changes
        auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });
    }, []);

    return (
        <AuthContext.Provider
            value={{
                currentUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
