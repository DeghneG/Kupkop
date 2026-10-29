import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// Same mark as the web app (canopy over a paw)
export default function KupkopMark({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3 13C3 7.8 7.2 3.5 12 3.5C16.8 3.5 21 7.8 21 13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M12 18.5C10 18.5 8.5 17 8.5 15.2C8.5 13.8 9.8 12.5 12 11.2C14.2 12.5 15.5 13.8 15.5 15.2C15.5 17 14 18.5 12 18.5Z"
        fill={color}
      />
      <Circle cx="8" cy="10.2" r="1.4" fill={color} />
      <Circle cx="16" cy="10.2" r="1.4" fill={color} />
      <Circle cx="12" cy="7.8" r="1.4" fill={color} />
    </Svg>
  );
}
