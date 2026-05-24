'use client'

import { useState, useEffect } from "react"
import { section } from "../../lib/definitions"
import Image from "next/image"
import { MagnifyingGlassIcon, TrashIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import EditPageSectionForm from "./edit-page-section-form";

function aIncludesB(string1: string, string2: string) {
  return (
    string1.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').includes(string2.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''))
  );
}
function getSectionNameTree(section: section) {
  let sectionNames: any = {}
  if (section.sections) {
    section.sections.forEach((section: section) => {
      sectionNames[section.name] = getSectionNameTree(section)
    })
  } else {  
    sectionNames[section.name] = null
  }
  return sectionNames
}

function recursivelyGetSectionNamesOfSection(section: section) {
  const sectionNames: string[] = []
  if (section.name) sectionNames.push(section.name)
  if (section.sections) {
    section.sections.forEach((section: section) => {
      sectionNames.push(...recursivelyGetSectionNamesOfSection(section))
    })
  }
  return sectionNames
}
function ElementBasedOnLevel({level, onClick, className, children}:{level: number,onClick:any, className: string, children: any}) {
  switch (level) {
    case 1:
      return <h1 onClick={onClick} className={`text-3xl font-bold ${className}`}>{children}</h1>;
    case 2:
      return <h2 onClick={onClick} className={`text-2xl font-bold ${className}`}>{children}</h2>;
    case 3:
      return <h3 onClick={onClick} className={`text-xl font-bold ${className}`}>{children}</h3>;
    case 4:
      return <h4 onClick={onClick} className={`text-lg font-bold ${className}`}>{children}</h4>;
    case 5:
      return <h5 onClick={onClick} className={`text-md font-bold ${className}`}>{children}</h5>;
    case 6:
      return <h6 onClick={onClick} className={`text-sm font-bold ${className}`}>{children}</h6>;
    default:
      return <div onClick={onClick} className={`text-sm ${className}`}>{children}</div>;
  }

}

export default function ExpandedPageSectionCard({ editable, page, session }: any) {
  const sections: section[] = page?.sections
  const tagDictionary: Record<string, string> = page.tagDictionary



  const [queryState, setQueryState] = useState('')
  const [relevantParents, setRelevantParents] = useState<string[]>([])

  // page.sections.indexOf(pageSection.name)


  return (
      <div>
        <div className="relative flex flex-1 flex-shrink-0">
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <input
          type="text"
          className={`peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-0 border-2 placeholder:text-gray-500`}
          placeholder={`Search ${page.title}`}
          onChange={(e) => setQueryState(e.target.value)}
        />

        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
        </div>
      {sections.filter((pageSection: section) => aIncludesB(pageSection.name, queryState)).map((pageSection: section, index: number) => (
        <SectionOrRecurse editable={editable} passedMatch={undefined} key={index} passedQuery={''} pageSection={pageSection} level={2} lineage={[pageSection.name]} tagDictionary={tagDictionary} />
      ))}
    </div>
  )
}

function SectionOrRecurse({
  editable=false, showAll,passedMatch, passedQuery, pageSection, level, lineage = [], tagDictionary = []
}: {
  editable:boolean, showAll?: boolean ,passedMatch:string | undefined,passedQuery: string, pageSection: section, level: number, lineage: string[], tagDictionary: any
}) {
  const [queryState, setQueryState] = useState('')
  const [showSection, setShowSection] = useState(true)
  const [match, setMatch] = useState<string | undefined>(undefined)
  const [showAllChildren, setShowAllChildren] = useState(showAll || false)
  const [editingState, setEditingState] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    // console.log('pageSection.name', pageSection.name, 'passedQuery', passedQuery)
    // console.log('lineage', lineage)
    // console.log('children', recursivelyGetSectionNamesOfSection(pageSection))
    const matchedChild = recursivelyGetSectionNamesOfSection(pageSection).find((name) => aIncludesB(name, passedQuery))
    setMatch(matchedChild)
    if(matchedChild) {
      // console.log(pageSection.name, 'shown because',passedQuery, 'in list of', recursivelyGetSectionNamesOfSection(pageSection))
      setShowSection(true)
    } else {
      setShowSection(false)
    }
    // console.log(queryState, passedQuery)
    if(passedMatch == pageSection.name || match == pageSection.name || showAll) {
      setShowAllChildren(true)
    } else {
      setShowAllChildren(false)
    }
  }, [passedQuery])

  useEffect(() => {
    console.log(lineage)
  }, [editingState])

  return (
      (showSection || showAll) && (!editingState ? <section className="rounded-lg border border-slate-300 my-2 p-1 overflow-hidden">
        <div className="flex flex-wrap">
          {pageSection.image && <Image src={pageSection.image} width={200} height={200} alt={pageSection.name + ' image'} />}
          {pageSection.images && pageSection.images.length > 0 && (
            pageSection.images.map((image: string, index: number) => (
              <Image key={index} src={image} width={200} height={200} alt={pageSection.name + ' image'} />
            ))
          )}
        </div>
        <div className="flex justify-between">
          {<ElementBasedOnLevel className="cursor-pointer hover:text-sky-500 " level={level} onClick={() => setExpanded(!expanded)}>{pageSection.name}</ElementBasedOnLevel> }
          {editable && <WrenchScrewdriverIcon className=" cursor-pointer h-10 w-10 text-yellow-500" onClick={() => setEditingState(!editingState)} />}
            
        </div>

        {pageSection.sections && pageSection.sections.length > 0 && expanded && <div className="relative flex flex-1 flex-shrink-0">
        <label htmlFor="search" className="sr-only">
          Search
        </label>
        <input
          type="text"
          className={`peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-0 border-2 placeholder:text-gray-500`}
          placeholder={`Search ${pageSection.name}`}
          onChange={(e) => setQueryState(e.target.value)}
        />

        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
        </div>}
        {<div>
          {pageSection.tags && Object.keys(pageSection.tags).length > 0 && (
          <ul>
            {pageSection.tags.map((tag: string, index: number) => (
              <li key={index} className="inline bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                {tagDictionary[tag] ? tagDictionary[tag] : tag}
              </li>
            ))}
          </ul>
        )}
        {pageSection.description && <div>{pageSection.description}</div>}
        {pageSection.notes && <div>{pageSection.notes}</div>}
        {expanded && pageSection.sections && pageSection.sections.length > 0 && pageSection.sections.sort((a:any, b:any) => a.order - b.order).map( (pageSection: section, index: number) =>
          
            <SectionOrRecurse 
              key={index}
              pageSection={pageSection} 
              level={level + 1} 
              lineage={[...lineage, pageSection.name]} 
              tagDictionary={tagDictionary} 
              passedQuery={queryState == '' ? passedQuery : queryState}
              passedMatch={match}
              showAll={showAllChildren}
              editable={editable}
            />
          
        )}
        </div>}
      </section> : <EditPageSectionForm pageSection={pageSection} editingState={editingState} setEditingState={setEditingState} lineage={lineage}/>)
  )
}
