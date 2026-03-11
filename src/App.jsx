import { useState } from 'react'
import {
  App as KonstaApp,
  Page,
  Navbar,
  Block,
  Button,
  BlockTitle,
} from 'konsta/react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <KonstaApp theme="ios" safeAreas>
      <Page>
        <Navbar title="Mobile App" />
        <BlockTitle>Welcome</BlockTitle>
        <Block strong inset>
          <p>Tu app móvil con Vite + React + Tailwind + Konsta + Capacitor.</p>
        </Block>
        <Block className="text-center">
          <Button onClick={() => setCount((c) => c + 1)}>
            Count: {count}
          </Button>
        </Block>
      </Page>
    </KonstaApp>
  )
}

export default App
