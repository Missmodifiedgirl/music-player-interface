import React from 'react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './Contact.css'


const Contact = () => {
  const[detail,setDetail]=useState({
    name:"John",
    age:20,
  });
  function handleChange(e){
        setDetail({...detail,[e.target.name]: e.target.value});

      

  }
  return (
    <div>
      Contact
      <h1 className='a'>My name is {detail.name}</h1>
      <input
      type="text"
        placeholder='Please enter your name'
        onChange={handleChange}
        value={detail.name}
        name='name'
      />
      <h1 className='b'>My age is {detail.age}</h1>
      <input
      type="number"
        placeholder='Please enter your age'
        onChange={handleChange}
        value={detail.age}
        name='age'
      />
      <br/>
      <Link to="/hai/"> Click to get Home</Link>
    </div>
  )
}

export default Contact
