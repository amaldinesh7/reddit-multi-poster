import React from 'react';
import { SettingsContextType } from './types';

export const SettingsContext = React.createContext<SettingsContextType>({
  addSubreddit: async () => null,
  updateCategory: async () => false,
  deleteCategory: async () => false,
  updateSubreddit: async () => false,
  deleteSubreddit: async () => false,
  fetchAndCache: async () => {},
  loading: {},
  errors: {},
  dragOverCategoryId: null,
});

export const useSettingsContext = () => React.useContext(SettingsContext);
