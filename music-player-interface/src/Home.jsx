import React from 'react'
import { Link } from 'react-router-dom'
import { useState } from 'react';
import './Home.css'

const Home = () => {
  const [detail, setDetail] = useState({
    name:"John",
  
    age:23,
  });
  function nameChange() {
    if (detail.name=="John")
    {
    setDetail({...detail, name:"Arun"});
    }
    else{
          setDetail({...detail, name:"John"});

    }
  }
  return (
    <div>
      Home
      <br />
      <h1 className='a'>My name is {detail.name}</h1>
      <button onClick={nameChange}>Change name</button>
      
      <br />
    </div>
  )
}

export default Home
