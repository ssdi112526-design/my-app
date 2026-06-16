import { createContext, useContext } from "react";

const MobileNavContext = createContext({ closeNav: () => {} });

export function MobileNavProvider({ value, children }) {
  return (
    <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
