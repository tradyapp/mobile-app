'use client';
import { App } from 'konsta/react';
import { FC } from 'react';

const AppWrapper: FC<{
    children:  React.ReactNode;
}> = ({ children }) => {
  return (
    // Wrap our app with App component
    <App theme="ios" dark={true} safeAreas={true} iosHoverHighlight={false}>
      {children}
    </App>
  );
}

export default AppWrapper;
