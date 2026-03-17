import React from 'react'
import { Block, Preloader } from 'konsta/react'

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <Block className="text-center">
        <div className="mb-4">
          <Preloader className="text-brand-primary" />
        </div>
      </Block>
    </div>
  )
}

export default LoadingScreen