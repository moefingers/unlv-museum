import settings from '../data/settings.json' assert { type: 'json' };

import {checkWidthOrHeightSituation} from "./checkWidthOrHeightSituation.js"
import { generateCharacter } from "./generateCharacter.js";
let heightValue = settings.windowSize.heightValue
let widthValue = settings.windowSize.widthValue
export function loadMap(fullMap, container){ //accept map as parameter when invoking

    container.innerHTML = ""
    let map = fullMap.map


            

    let fullControlSize //initialize variable for later if statement
    let fullControlSizeByPercent
// dynamic adjustment for individual control size for map window.. if width and height do not equal then this must exist
// The value compared in the if statement will be smaller if less of it can fit given the dimension
/* For example, 
if (you have a small heightValue for the window), and (a large map.length (how many blocks tall is the map)) then 
    heightValue/map.length returns a small number because large / small .. and vice versa.
*/

//TBD dynamic window resizing during gameplay
console.log(container.parentElement.style.width)
    let containerWidthInPx = parseInt(container.parentElement.style.width) * parseInt(container.style.width) /100
    let containerHeightInPx = parseInt(container.parentElement.style.height) * parseInt(container.style.height) /100

    fullControlSize = checkWidthOrHeightSituation(containerWidthInPx, containerHeightInPx, map[0].length, map.length, 0.9)

    let controlOffset = fullControlSize * .02   
    //console.log(fullControlSize)
    let fullEdgeSize = {"length":fullControlSize-( controlOffset *2), "girth":fullControlSize/12} // edge sizing for each control TBD dynamic girth

    // making some classes for types of players' areas
    const controlBlockStyleGeneric = `background:gray;opacity:0.3;`
    
    let halfEdgeStartStyleGeneric = `width:${fullEdgeSize.length/2}px;height:${fullEdgeSize.girth}px`
    let halfEdgeEndStyleGeneric = `width:${fullEdgeSize.length/2}px;height:${fullEdgeSize.girth}px`
    
    
    let halfEdgeStartStyleGreen = `${halfEdgeStartStyleGeneric};background:green;`
    let halfEdgeEndStyleGreen = `${halfEdgeEndStyleGeneric};background:green;`
    
    let halfEdgeStartStyleRed = `${halfEdgeStartStyleGeneric};background:red;`
    let halfEdgeEndStyleRed = `${halfEdgeEndStyleGeneric};background:red;`
    
    let halfEdgeStartStyleGray = `${halfEdgeStartStyleGeneric};background:gray;`
    let halfEdgeEndStyleGray = `${halfEdgeEndStyleGeneric};background:gray;`

    let mapArea = document.createElement("div")
    mapArea.id = "mapArea"
    mapArea.style.width = (`${(map[0].length) * fullControlSize}px`) //setting map width and height based on amount of controls
    mapArea.style.height = (`${(map.length) * fullControlSize}px`)
    mapArea.style.position = "absolute"
    mapArea.style.left = ("50%")
    mapArea.style.top = ("50%")
    mapArea.style.translate = ("-50% -50%")
    container.append(mapArea)

    for(let selectedRow = 0; selectedRow < map.length; selectedRow++){ //initialize row number as 0, select rows while less than map.length, etc.
        let currentRowArray = (map[selectedRow]) //select row from map (for readability)
        for(let selectedBlock = 0; selectedBlock < currentRowArray.length; selectedBlock++){// intialize block number as 0, select blocks while less than map.length, etc.

            

            let controlProperties = {
              active: currentRowArray[selectedBlock],
              pseudoCoordinates: [selectedBlock + 1,selectedRow + 1]
            };
            //console.log(controlProperties.pseudoCoordinates)

            let rightControlProperties = {
                active: "", // this block will not exist since it is after everything
                pseudoCoordinates: [selectedBlock + 2,selectedRow + 1]
            };
            if(selectedBlock + 1 >= currentRowArray.length ){rightControlProperties.active = 0}
            else if (selectedBlock < currentRowArray.length) {rightControlProperties.active = currentRowArray[selectedBlock + 1]}
            //console.log(`${rightControlProperties.pseudoCoordinates} active: ${rightControlProperties.active}`)

            let belowControlProperties = {
            active: "", //this row will not exist since it is after everything
            pseudoCoordinates: [selectedBlock + 1,selectedRow + 2]
            };
            if(selectedRow + 1 >= map.length ){belowControlProperties.active = 0}
            else if (selectedRow < map.length) {belowControlProperties.active = map[selectedRow + 1][selectedBlock]}
            //console.log(`${belowControlProperties.pseudoCoordinates} active: ${belowControlProperties.active}`)

            if (controlProperties.active == true){ // this value will actually be 1, but using boolean for readability
                //console.log(`${controlProperties.pseudoCoordinates} active`)
                let locationX = selectedBlock * fullControlSize
                let locationY = selectedRow * fullControlSize
                // MAKE BLOCK
                let control = document.createElement("div")
                control.id = `control-x${controlProperties.pseudoCoordinates[0]}-y${controlProperties.pseudoCoordinates[1]}`
                control.className = "controlBlock"
                control.style = controlBlockStyleGeneric
                control.style.width = `${fullControlSize}px`
                control.style.height = `${fullControlSize}px`
                control.style.position ="absolute"
                control.style.transformOrigin = "0px 0px"
                control.style.translate = `${locationX}px ${locationY}px`
                mapArea.append(control)

                // MAKE HORIZONTAL EDGES (with dynamically named IDs )
                function horizontalEdge(controlCoordinates, locY){
                    let controlHorizontalStart = document.createElement("div")
                    controlHorizontalStart.id = `controlHorizontalStart-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlHorizontalStart.className = "halfEdgeStart"
                    controlHorizontalStart.style = halfEdgeStartStyleGray

                    let controlHorizontalEnd = document.createElement("div")
                    controlHorizontalEnd.id = `controlHorizontalEnd-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlHorizontalEnd.className = "halfEdgeEnd"
                    controlHorizontalEnd.style = halfEdgeEndStyleGray

                    let controlHorizontal = document.createElement("div")
                    controlHorizontal.id = `controlHorizontal-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlHorizontal.className = "halfEdgeContainer"
                    controlHorizontal.style.width = `${fullEdgeSize.length}px`
                    controlHorizontal.style.position ="absolute"
                    controlHorizontal.style.transformOrigin = "0px 0px"
                    controlHorizontal.style.translate = `${locationX + controlOffset}px ${locY -(fullEdgeSize.girth /2)}px`

                    controlHorizontal.append(controlHorizontalStart)
                    controlHorizontal.append(controlHorizontalEnd)

                    mapArea.append(controlHorizontal)
                }
                // MAKE VERTICAL EDGES (with dynamically named IDs )
                function verticalEdge(controlCoordinates, locX){
                    let controlVerticalStart = document.createElement("div")
                    controlVerticalStart.id = `controlVerticalStart-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlVerticalStart.className = "halfEdgeStart"
                    controlVerticalStart.style = halfEdgeStartStyleGray

                    let controlVerticalEnd = document.createElement("div")
                    controlVerticalEnd.id = `controlVerticalEnd-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlVerticalEnd.className = "halfEdgeEnd"
                    controlVerticalEnd.style = halfEdgeEndStyleGray

                    let controlVertical = document.createElement("div")
                    controlVertical.id = `controlVertical-x${controlCoordinates[0]}-y${controlCoordinates[1]}`
                    controlVertical.className = "halfEdgeContainer"
                    controlVertical.style.width = `${fullEdgeSize.length}px`
                    controlVertical.style.position ="absolute"
                    controlVertical.style.transformOrigin = "0px 0px"
                    controlVertical.style.rotate = "90deg"
                    controlVertical.style.translate = `${locX +(fullEdgeSize.girth /2)}px ${locationY +controlOffset}px`

                    controlVertical.append(controlVerticalStart)
                    controlVertical.append(controlVerticalEnd)

                    mapArea.append(controlVertical)
                }
                verticalEdge(controlProperties.pseudoCoordinates, locationX)
                if(rightControlProperties.active == false){
                    verticalEdge(rightControlProperties.pseudoCoordinates, (locationX + fullControlSize))
                }
                horizontalEdge(controlProperties.pseudoCoordinates, locationY)
                if(belowControlProperties.active == false){
                    horizontalEdge(belowControlProperties.pseudoCoordinates, (locationY + fullControlSize))
                }
               
                
            } else if (controlProperties.active == false){
                //console.log(`${controlProperties.pseudoCoordinates} not active`)
            }
        }
    }



    // let characterSize = [50,50]
    // generateCharacter("green", characterSize, fullMap.spawns.player1, ["w","a","s","d"], fullControlSize)
    // generateCharacter("red", characterSize, fullMap.spawns.player2,  ["ArrowUp","ArrowLeft","ArrowDown","ArrowRight"],fullControlSize)
    // generateCharacter("blue", characterSize, fullMap.spawns.player3,  ["8","4","5","6"],fullControlSize)
    // generateCharacter("lightblue", characterSize, fullMap.spawns.player4,  ["i","j","k","l"],fullControlSize)

    return {
        mapSize:[map[0].length,map.length],
        fullControlSize:fullControlSize,
        spawns:fullMap.spawns,
        mapAreaElement: mapArea
    }
}