import React, { useRef, useEffect, useState } from 'react'

type InfiniteScrollProps<T> = {
  fetchData: (size: number, offset: number) => Promise<T[] | undefined>
  size: number
  renderElement: (element: T) => React.ReactNode
  containerRef: React.RefObject<HTMLDivElement>
  loaderComponent?: React.ReactNode
}

export default function InfiniteScroll<T>({
  containerRef,
  fetchData,
  loaderComponent,
  size,
  renderElement,
}: InfiniteScrollProps<T>) {
  const numberOfPagesRendered = 2
  const maxNumberOfElements = size * numberOfPagesRendered

  const lowerTarget = useRef(null)
  const upperTarget = useRef(null)

  const backwardLoaderComponent = useRef<HTMLDivElement>(null)

  const [prevOffset, setPrevOffset] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)

  const [fetchDataForward, setFetchDataForward] = useState(false)
  const [fetchDataBackward, setFetchDataBackward] = useState(false)

  const [dataFinished, setDataFinished] = useState(false)

  const [data, setData] = useState<T[] | undefined>([])

  const [loading, setLoading] = useState(false)

  const forwardThreshold = Math.floor((data?.length || size) - (0.2 * size))
  const backwardThreshold = Math.floor(0.2 * size)

  useEffect(() => {
    // whenever the fetch function changes, we want to reset the data
    //  and go staight to the top of the container
    const fetch = async () => {
      const data = await fetchData(size, 0)
      setLoading(false)
      setData(data)
      setPrevOffset(0)
      setNextOffset(0)
      setDataFinished(false)
      containerRef!.current!.scrollTop = 0
    }
    setLoading(true)
    fetch()
  }, [fetchData])

  useEffect(() => {
    // this observer is responsible for loading more data when you scroll down
    // it does it by setting the nextOffset which in turn will trigger
    // rerender and the useEffect below will fetch the data in the next render cycle
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setNextOffset((prev) => prev + size)
          setFetchDataForward(true)
          setFetchDataBackward(false)
        }
      },
      { threshold: 1 },
    )

    if (lowerTarget.current) {
      observer.observe(lowerTarget.current)
    }

    return () => {
      if (lowerTarget.current) {
        observer.unobserve(lowerTarget.current)
      }
    }
  }, [data])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setPrevOffset((prev) => {
            const modulo = data?.length! % size
            // it can happen that the data lenght is not exactly a multiple of size
            // in that case we have to calculate how many elements above the closest multiple of size
            // we have to go, and set it as the next prev offset
            const newOffset = (modulo === 0) ? prev - size : prev - (data?.length! - modulo * size)
            // we can never go below 0 so we have to check for that and set 0 in case the counter
            // shoots past it
            return Math.max(0, newOffset)
          })
          setFetchDataForward(false)
          setFetchDataBackward(true)
        }
      },
      { threshold: 1 },
    )

    if (upperTarget.current) {
      observer.observe(upperTarget.current)
    }

    return () => {
      if (upperTarget.current) {
        observer.unobserve(upperTarget.current)
      }
    }
  }, [data])

  useEffect(() => {
    // this useEffect is responsible for fetching more data when you scroll down
    // it's triggered by the nextOffset change in the useEffect above
    // in case we have more data than defined by size * numberOfPagesRendered we
    // remove the data from the beginning of data array so that we keep the contanstat
    // amount of element rendered in the container
    // in this scenario scroll behaves as expected so we don't have to adjust anything
    // after the data has been fetched
    const handleExcessData = (data: T[]) => {
      setPrevOffset(prev => prev + (data.length - maxNumberOfElements))
      return data.slice(-maxNumberOfElements)
    }

    const fetch = async () => {
      const moreData = await fetchData(size, nextOffset)

      if (moreData?.length! < size) setDataFinished(true)

      const newData = [...(data || []), ...(moreData || [])]
      const limitedData = newData.length > maxNumberOfElements ? handleExcessData(newData) : newData
      setLoading(false)
      setData(limitedData)
      setFetchDataForward(false)
    }

    if (fetchDataForward) {
      setLoading(true)
      fetch()
    }
  }, [nextOffset])

  useEffect(() => {
    // this useEffect is responsible for fetching more data when you scroll up
    // it's triggered by the prevOffset change in the useEffect above
    // in case we have more data than defined by size * numberOfPagesRendered we
    // remove the data from the end of data array so that we keep the contanstat
    // when we fetch data backward we want to keep the scroll position so that it shows the same
    // elements as before the fetch. This is pretty complicated
    // the assumption I made is that the height of every element is the same which will not
    // work in every case
    const handleExcessData = (data: T[]) => {
      setNextOffset(prev => prev - (data.length - maxNumberOfElements))
      return data.slice(0, maxNumberOfElements)
    }

    const fetch = async () => {
      const moreData = await fetchData(size, prevOffset)
      setLoading(false)

      const newData = [...(moreData || []), ...(data || [])]
      const limitedData = newData.length > maxNumberOfElements ? handleExcessData(newData) : newData
      setData(limitedData)
      // in case we have a loader component we have to subtract it from from the calculations of the
      // height as it's not visible when the lists are loaded
      const loaderComponentHeight = (backwardLoaderComponent.current as HTMLDivElement)?.offsetHeight || 0

      // this is to adjust the scroll position. We first have to calculate the height of a single element
      // and then scroll by the number of elements we fetched. Usually it will be the size but not always
      // in case the last returned non empty data array is less than size
      // if we have a loader component we have to also take it into consideration and adjust the
      // scroll so that the new elements are placed exaclty where the loader component was
      const heightOfSingleElement = (containerRef!.current!.scrollHeight - loaderComponentHeight) / maxNumberOfElements
      containerRef!.current!.scrollTop += moreData!.length * heightOfSingleElement - loaderComponentHeight

      // if the container has padding-top set the following happens:
      // the data is initially fetched the padding is visible on the top as expected
      // when we scroll down the padding is "not visible" and while we scroll up the elements
      // "touch" the borders of the container. So the padding "works" only when we render the beginning
      // of the list. For a brief moment when we fetch the data backwards when we scroll up
      // the container treats the list as the beginning of the list and shows the padding, after
      // the data has been loaded the padding "disappears" which causes a layout shift and is
      // not pleasent to the user. We want to keep the initial padding only when we really render
      // the beginning of the list
      if (prevOffset > 0) containerRef!.current!.style.paddingTop = '0px'
      else containerRef!.current!.style.paddingTop = ''

      setFetchDataBackward(false)
    }

    if (fetchDataBackward) {
      setLoading(true)
      fetch()
    }
  }, [prevOffset])

  if (!fetchDataForward && !fetchDataBackward && loading) return loaderComponent

  return (data || []).map((element: T, idx: number) => {
    if (idx === 0 && loaderComponent && loading && fetchDataBackward) {
      return (
        <>
          <div ref={backwardLoaderComponent}>
            {loaderComponent}
          </div>
          {renderElement(element)}
        </>
      )
    }
    if (prevOffset > 0 && idx === backwardThreshold) {
      return (
        <>
          <div ref={upperTarget}/>
          {renderElement(element)}
        </>
      )
    }
    if (idx === forwardThreshold && !dataFinished) {
      return (
        <>
          {renderElement(element)}
          <div ref={lowerTarget}/>
        </>
      )
    }
    if (idx === (data || []).length - 1 && loaderComponent && !dataFinished && fetchDataForward) {
      return (
        <>
          {renderElement(element)}
          {loaderComponent}
        </>
      )
    }
    return renderElement(element)
  })
}
