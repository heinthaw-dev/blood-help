import { PhoneEntry } from './screens/PhoneEntry'

function App() {
  return <PhoneEntry onSend={(digits) => console.log('send code to +95', digits)} />
}

export default App
