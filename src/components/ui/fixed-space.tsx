import React from 'react';
import { View } from 'react-native';

interface FixedSpaceProps {
  width?: number;
}

/**
 * A component that provides a fixed amount of space between items in a bar.
 * Inspired by Apple's UIBarButtonItem.SystemItem.fixedSpace
 */
export const FixedSpace = ({ width = 16 }: FixedSpaceProps) => {
  return <View style={{ width }} />;
};
