# infinite-react-scroll
A simple component for handling veeery long lists in React

It always renders only 2 pages (2 x size) to keep the list performant and loads more pages as you scroll up or down.

## example
You can either run the example or copy the code below to your project.

To run the example:
```
cd examples
yarn install
yarn run dev
```

How to use:

```js
import React, { useRef } from 'react'

import { InfiniteScroll } from 'infinite-react-scroll'

import './App.css'

type Todo = {
  id: number
  todo: string
  completed: boolean
  userId: number
}

const App = () => {
  const container = useRef<HTMLDivElement>(null)

  const handleFetchData = async (size: number, offset: number) => {
    const response = await fetch(`https://dummyjson.com/todos?skip=${offset}&limit=${size}`)
    const data = await response.json()
    return data.todos
  }

  const renderElement = (todo: Todo) => {
    return (
      <div key={todo.id}>
        <input type='checkbox' checked={todo.completed} />
        <span>{todo.todo}</span>
      </div>
    )
  }

  return (
    <div className='App'>
      <div className='InfiniteScroll' ref={container}>
        <InfiniteScroll
          containerRef={container}
          fetchData={handleFetchData}
          loaderComponent={<div>Loading...</div>}
          renderElement={renderElement}
          size={30}
        />
        </div>
    </div>
  )
}

export default App
```
