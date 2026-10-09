import React from 'react'
import { Link } from 'react-router-dom'
import { useState } from 'react'

const UserDetails = () => {
    const[detail,setDetail]=useState({
        yourName:"John",
        age:20,
        emailId:"john123@gmail.com"
      });

    function handleChange(e){
        setDetail({...detail,[e.target.name]: e.target.value});}

    function display(){
        console.log("name:",detail.yourName)
        console.log("age:",detail.age)
        console.log("email:",detail.emailId)

    }
  return (
    <div>
        <h1 className='a'>My name is {detail.yourName}</h1>

        <input
      type="text"
        placeholder='Waiting for input'
        onChange={handleChange}
        name='yourName'
      />
      <h1 className='b'>My age is {detail.age}</h1>
      <input
      type="number"
        placeholder='Waiting for input'
        onChange={handleChange}
        name='age'
      />

      
      <h1 className='c'>My e-mail id is {detail.emailId}</h1>
      <input
      type="text"
        placeholder='Waiting for input'
        onChange={handleChange}
        name='emailId'
      />
      <br/>
            <br/>

      <button onClick={display}>Submit</button>
    </div>
  )
}

export default UserDetails