import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const IndustryContext = createContext(null);

export function IndustryProvider({ children }) {
  const { user, isAdmin } = useAuth();
  
  // If the user is an admin, they can select an industry.
  // Otherwise, their industry is fixed to their own.
  const [selectedIndustry, setSelectedIndustry] = useState(() => {
    return localStorage.getItem('selectedIndustry') || '';
  });

  useEffect(() => {
    if (selectedIndustry) {
      localStorage.setItem('selectedIndustry', selectedIndustry);
    } else {
      localStorage.removeItem('selectedIndustry');
    }
  }, [selectedIndustry]);

  useEffect(() => {
    if (!user) {
      setSelectedIndustry('');
    } else if (user && !isAdmin && user.industry_name) {
      setSelectedIndustry(user.industry_name);
    }
  }, [user, isAdmin]);

  return (
    <IndustryContext.Provider value={{ selectedIndustry, setSelectedIndustry }}>
      {children}
    </IndustryContext.Provider>
  );
}

export const useIndustry = () => useContext(IndustryContext);
