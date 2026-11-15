import { useMemo, useState } from 'react'
import './App.css'
import { Header } from './components/Header'
import Table from './components/Table'

const apiData = {
  hierarchy: [
    {
      name: 'Khartoum',
      cities: [
        {
          name: 'Omdurman',
          areas: [{ name: 'Umbadda', id: 2 }],
        },
        {
          name: 'Khartoum',
          areas: [
            { name: 'Jabra', id: 3 },
            { name: 'Alshajara', id: 4 },
          ],
        },
      ],
    },
  ],
}

function App() {
  const [selectedState, setSelectedState] = useState(apiData.hierarchy[0].name)
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedArea, setSelectedArea] = useState('')

  const state = useMemo(
    () => apiData.hierarchy.find((item) => item.name === selectedState),
    [selectedState],
  )

  const cities = state?.cities ?? []
  const areas = cities.find((city) => city.name === selectedCity)?.areas ?? []

  return (
    <div className="app-shell">
      <Header />

      <div className="selector-panel">
        <div className="selector-column">
          <label>State</label>
          <select value={selectedState} onChange={(e) => {
            setSelectedState(e.target.value)
            setSelectedCity('')
            setSelectedArea('')
          }}>
            {apiData.hierarchy.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="selector-column">
          <label>City</label>
          <select value={selectedCity} onChange={(e) => {
            setSelectedCity(e.target.value)
            setSelectedArea('')
          }} disabled={!cities.length}>
            <option value="">Select city</option>
            {cities.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div className="selector-column">
          <label>Area</label>
          <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} disabled={!areas.length}>
            <option value="">Select area</option>
            {areas.map((area) => (
              <option key={area.id} value={area.name}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table />
    </div>
  )
}

export default App
