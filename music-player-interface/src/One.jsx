import React from 'react'
import './One.css'
const One = () => {
  return (
    <div>
        <h1>LOGIN PAGE</h1>
        <h3>User Name:</h3>
        <input type="text" placeholder='Enter User Name' className='a'></input>
        <br/>
        <h3>Password:</h3>
        <input type="password" placeholder='Enter Password' className='a'></input>
        <br/>
        <button className='but'>Submit</button>

    </div>
  )
}

export default One