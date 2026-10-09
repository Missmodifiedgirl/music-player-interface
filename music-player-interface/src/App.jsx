import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import One from './One'
import Home from './Home'
import Contact from './Contact'
import UserDetails from './UserDetails'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/hello/" element={<One />} />
        <Route path="/hai/" element={<Home />} />
        <Route path="/hell/" element={<Contact />} />
        <Route path="/hel/" element={< UserDetails/>} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
