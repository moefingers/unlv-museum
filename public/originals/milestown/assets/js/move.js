
let scoreObject = {1:0,2:0,3:0,4:0}

let pulse = [

    {offset: 0, fontSize: "20px", opacity: 1, easing: "ease-out"},
    {offset: 0.6, fontSize: "30px", opacity: .5},
    {offset: 0.8, fontSize: "30px", opacity: .5},
    {offset: 1, fontSize: "20px", opacity: 1}
]

export function move(element, playerNumber) {

        let direction
    function moveToCoordinates(locArray) {

        
        let x = locArray[0] * fullControlSize
        let y = locArray[1] * fullControlSize
        element.pseudoCoordinates = [locArray[0],locArray[1]]
        element.style.left = x + 'px'
        element.style.top = y + 'px'
    }

    function moveWithKeys(locArray, keyArray, fullControlSize, teamColor, callback){

        let movementInterval = 300
        console.log(fullControlSize)
        let microHalfFullControlSize = fullControlSize /2 /300 * 10
        console.log(microHalfFullControlSize)
        let movementAllowed = true
        let movementDelay
        let keysHeld = []
        let allKeysReleased = true
        let x = locArray[0] * fullControlSize
        let y = locArray[1] * fullControlSize
        let originalX
        let originalY
        let coordinateX = locArray[0]
        let coordinateY = locArray[1]
    
        // for(let keyIndex = 0; keyIndex < keyArray.length; keyIndex++){
        //     if (keyArray[keyIndex].length > 1){}
        // }
        let upKey = keyArray[0]
        let leftKey = keyArray[1]
        let downKey = keyArray[2]
        let rightKey = keyArray[3]
       


        element.style.left = x + 'px'
        element.style.top = y + 'px'
        
        function moveCharacter(){ 
            
            // function checkValidTravelPath(coorX, coorY, addX, addY){
            //     let subtractedHalf = false
            //     let query
            //     //console.log(coorX)
            //     if (addX != 0){
            //         console.log("working")
            //         if (coorX.toString().includes(".5")){
            //             subtractedHalf = "x"
            //             coorX+=addX
            //             query = `#controlHorizontalStart-x${coorX + 1 + (addX * 2)}-y${coorY + 1}`
            //         }
            //         if (coorY.toString().includes(".5")){
            //             return coorX
            //         } 
            //     } else if (addY != 0){
            //         if (coorY.toString().includes(".5")){
            //             subtractedHalf = "y"
            //             coorY+=addY
            //             query = `#controlHorizontalStart-x${coorX + 1}-y${coorY + 1 + (addY * 2)}`
            //         }
            //         if (coorX.toString().includes(".5")){
            //             return coorY
            //         } 
            //     }
                
            //     if(document.querySelector(query)){
            //         x+=fullControlSize*addX
            //         y+=fullControlSize*addY
            //         if(subtractedHalf == "x"){coorX+=addX; return coorX} else if(subtractedHalf == "y"){coorY+=addY; return coorY} else {console.log("poopy")}
            //     }
            
            // }
            //console.log(direction)
            if(direction == "null"){
                // console.log("returned successfully")
                    return direction
                }
            if(movementAllowed === true && direction != "null" && !allKeysReleased){
                // console.log("running with direction as " + direction)
                let capturedEdge
                let firstControl
                let firstControlEdges
                let secondControl
                let secondControlEdges
                let captureX
                let captureY

                
                if(direction === 'left'){
                    //coordinateX = checkValidTravelPath(coordinateX, coordinateY, -0.5, 0)
                    let subtractedHalf = false
                    let controlTypeName = "HorizontalEnd"
                    if (coordinateX.toString().includes(".5")){
                        subtractedHalf = true
                        controlTypeName = "HorizontalStart"
                        coordinateX+=0.5
                    }
                    if (coordinateY.toString().includes(".5")){
                        return coordinateY
                    } 
                    // this is where movement happens \/
                    capturedEdge = document.querySelector(`#control${controlTypeName}-x${coordinateX}-y${coordinateY + 1}`)
                    // console.log(capturedEdge)
                    if(capturedEdge){
                        captureX = true
                        originalX = x
                        x-=fullControlSize/2
                        
                        firstControl = document.querySelector(`#control-x${coordinateX}-y${coordinateY}`)
                        firstControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+1}`),
                        ]
                        
                        secondControl = document.querySelector(`#control-x${coordinateX}-y${coordinateY+1}`)
                        
                        secondControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+2}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+2}`),
                        ]
                        coordinateX-=0.5
                        if(subtractedHalf == true){coordinateX-=0.5}
                        
                        // console.log("controls") 
                        // console.log(firstControl)
                        // console.log(firstControlEdges)
                        // console.log(secondControl)
                        // console.log(secondControlEdges)

                    }
                }
                if(direction === 'up'){
                    //coordinateY = checkValidTravelPath(coordinateX,coordinateY, 0, -0.5)
                    let subtractedHalf = false
                    let controlTypeName = "VerticalEnd"
                    if (coordinateY.toString().includes(".5")){
                        subtractedHalf = true
                        controlTypeName = "VerticalStart"
                        coordinateY+=0.5
                    }
                    if (coordinateX.toString().includes(".5")){
                        return coordinateX
                    } 

                    capturedEdge = document.querySelector(`#control${controlTypeName}-x${coordinateX + 1}-y${coordinateY}`)
                    // console.log(capturedEdge)
                    if(capturedEdge){
                        captureY = true
                        originalY = y
                        y-=fullControlSize/2
                        
                        firstControl = document.querySelector(`#control-x${coordinateX}-y${coordinateY}`)
                        firstControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+1}`),
                        ]
                        
                        secondControl = document.querySelector(`#control-x${coordinateX+1}-y${coordinateY}`)
                        
                        secondControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+2}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+2}-y${coordinateY}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                        ]
                        coordinateY-=0.5
                        if(subtractedHalf == true){coordinateY-=0.5}
                        
                        // console.log("controls") 
                        // console.log(firstControl)
                        // console.log(firstControlEdges)
                        // console.log(secondControl)
                        // console.log(secondControlEdges)

                    }
                }
                if(direction === 'right'){
                    let subtractedHalf = false
                    let controlTypeName = "HorizontalStart"
                    if (coordinateX.toString().includes(".5")){
                        subtractedHalf = true
                        controlTypeName = "HorizontalEnd"
                        coordinateX-=0.5
                    }
                    if (coordinateY.toString().includes(".5")){
                        return coordinateY
                    } 
                    capturedEdge = document.querySelector(`#control${controlTypeName}-x${coordinateX + 1}-y${coordinateY + 1}`)
                    // console.log(capturedEdge)
                    if(capturedEdge){
                        captureX = true
                        originalX = x
                        x+=fullControlSize/2
                        
                        firstControl = document.querySelector(`#control-x${coordinateX+1}-y${coordinateY}`)
                        firstControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+2}-y${coordinateY}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+2}-y${coordinateY}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                        ]
                        
                        secondControl = document.querySelector(`#control-x${coordinateX+1}-y${coordinateY+1}`)
                        
                        secondControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+2}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+2}-y${coordinateY+1}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+2}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+2}`),
                        ]
                        coordinateX+=0.5
                        if(subtractedHalf == true){coordinateX+=0.5}
                        
                        // console.log("controls") 
                        // console.log(firstControl)
                        // console.log(firstControlEdges)
                        // console.log(secondControl)
                        // console.log(secondControlEdges)


                        
                    }
                }
                if(direction === 'down'){
                    let subtractedHalf = false
                    let controlTypeName = "VerticalStart"
                    if (coordinateY.toString().includes(".5")){
                        subtractedHalf = true
                        controlTypeName = "VerticalEnd"
                        coordinateY-=0.5
                    }
                    if (coordinateX.toString().includes(".5")){
                        return coordinateX
                    } 

                    capturedEdge = document.querySelector(`#control${controlTypeName}-x${coordinateX + 1}-y${coordinateY + 1}`)
                    // console.log(capturedEdge)
                    // this is if it does something \/
                    if(capturedEdge){
                        captureY = true
                        originalY = y
                        y+=fullControlSize/2
                        
                        firstControl = document.querySelector(`#control-x${coordinateX}-y${coordinateY+1}`)
                        firstControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX}-y${coordinateY+2}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX}-y${coordinateY+2}`),
                        ]
                        
                        secondControl = document.querySelector(`#control-x${coordinateX+1}-y${coordinateY+1}`)
                        
                        secondControlEdges = [
                            document.querySelector(`#controlVerticalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalStart-x${coordinateX+2}-y${coordinateY+1}`),
                            document.querySelector(`#controlVerticalEnd-x${coordinateX+2}-y${coordinateY+1}`),
                            
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+1}`),
                            document.querySelector(`#controlHorizontalStart-x${coordinateX+1}-y${coordinateY+2}`),
                            document.querySelector(`#controlHorizontalEnd-x${coordinateX+1}-y${coordinateY+2}`),
                        ]
                        coordinateY+=0.5
                        if(subtractedHalf == true){coordinateY+=0.5}

                        // console.log("controls") 
                        // console.log(firstControl)
                        // console.log(firstControlEdges)
                        // console.log(secondControl)
                        // console.log(secondControlEdges)


                    }
                }
                element.style.left = x + 'px'
                element.style.top = y + 'px'
               
                let moveAnimation
                if (captureX){
                    moveAnimation = [
                        { left: originalX + "px", opacity: 1, easing: "ease-out" },
                        {opacity: 0.5},
                        { left: x + "px", opacity: 1, easing: "ease-in" }
                    ]
                } else if (captureY){
                    moveAnimation = [
                        {top: originalY + 'px', opacity: 1, easing: "ease-out" },
                        {opacity: 0.5},
                        {top: y + 'px', opacity: 1, easing: "ease-in" }
                    ] 
                }



                if(capturedEdge){
                    let captureAnimation =[
                        {background: capturedEdge.style.background, opacity: 1},
                        {opacity: 0.8,},
                        {background: teamColor, opacity: 1, easing: "ease-in" }
                    ] 
                    element.animate( moveAnimation,movementInterval)
                    capturedEdge.animate(captureAnimation, movementInterval)
                    //setTimeout(() => {
                        capturedEdge.style.background = teamColor
                    //}, movementInterval);
                }

                function allEqual(array){
                    return array.every(item => 
                        item.style.background == array[0].style.background)
                }
              

                function controlEdgesCheck(control, controlEdges){
                    if(control){
                        //setTimeout(() => {
                            if(allEqual(controlEdges)){

                                if (control.style.background != teamColor){
                                    control.animate([{background:control.style.background},{background:teamColor}], movementInterval)
                                    control.owner = playerNumber
                                    console.log(control.owner)
                                    control.style.background = teamColor

                                    scoreObject[playerNumber]++
                                    let scoreElement = document.getElementById("score" + playerNumber)
                                    scoreElement.textContent = `${teamColor.toUpperCase()}: ${scoreObject[playerNumber]}`
                                    scoreElement.score = scoreObject[playerNumber]
                                    scoreElement.animate(pulse, 700)
                                }
                            }
                            else if (!allEqual(controlEdges)){
                                if (control.style.background !="gray"){
                                    let oldOwner = control.owner
                                    let oldColor = control.style.background
                                    console.log(oldOwner)
                                    control.animate([{background:control.style.background},{opacity: 0},{background:"gray"}], movementInterval)
                                    control.style.background = "gray"
                                    control.owner = ""

                                    scoreObject[oldOwner]--
                                    let oldScoreElement = document.getElementById("score" + oldOwner)
                                    oldScoreElement.textContent = `${oldColor.toUpperCase()}: ${scoreObject[oldOwner]}`
                                    oldScoreElement.score = scoreObject[oldOwner]
                                    oldScoreElement.animate(pulse,700)
                                }
                            }
                        //}, movementInterval);
                    }
                }

                controlEdgesCheck(firstControl, firstControlEdges)
                controlEdgesCheck(secondControl, secondControlEdges)


                movementAllowed = false
                setTimeout(() => {movementAllowed = true}, movementInterval)
                //console.log(coordinateX, coordinateY)
            }
            let timerDivTime = parseInt(document.getElementById("timerDiv").time)
            console.log(timerDivTime)
            if(timerDivTime <= 0){clearInterval(intervalForMovement)}
        }

        let intervalForMovement = setInterval(moveCharacter, 1)
        
        document.addEventListener('keydown', function(e){
            //if(e.repeat) return;
            //if(movementAllowed === true){
                let keyToPush
                function formatKeyToPush(key){
                    
                    if (key.length > 1){
                        keyToPush = key
                    } else if (key.length == 1) {
                        keyToPush = key.toLowerCase()
                    } else (
                        console.log("poopy")
                    )
                    console.log(keyToPush)
                }

                if(e.key === leftKey || e.key === leftKey.toUpperCase()){
                    direction = 'left'
                    allKeysReleased = false
                    formatKeyToPush(leftKey)
                    if(!keysHeld.includes(leftKey) && !keysHeld.includes(leftKey.toUpperCase()) && !keysHeld.includes(leftKey.toLowerCase())) {keysHeld.push(keyToPush)}
                }
                if(e.key === upKey || e.key === upKey.toUpperCase()){
                    direction = 'up'
                    allKeysReleased = false
                    formatKeyToPush(upKey)
                    if(!keysHeld.includes(upKey) && !keysHeld.includes(upKey.toUpperCase()) && !keysHeld.includes(upKey.toLowerCase())) {keysHeld.push(keyToPush)}
                }
                if(e.key === rightKey || e.key === rightKey.toUpperCase()){
                    direction = 'right'
                    allKeysReleased = false
                    formatKeyToPush(rightKey)
                    if(!keysHeld.includes(rightKey) && !keysHeld.includes(rightKey.toUpperCase()) && !keysHeld.includes(rightKey.toLowerCase())) {keysHeld.push(keyToPush)}
                }
                if(e.key === downKey || e.key === downKey.toUpperCase()){
                    direction = 'down'
                    allKeysReleased = false
                    formatKeyToPush(downKey)
                    if(!keysHeld.includes(downKey) && !keysHeld.includes(downKey.toUpperCase()) && !keysHeld.includes(downKey.toLowerCase())) {keysHeld.push(keyToPush)}
                }
              //  console.log(direction)
            //}
            //movementAllowed = false
            //console.log("keys held below")
            //console.log(keysHeld)
            //callback(direction)
        })
        
        document.addEventListener('keyup', function(e){
            
            if(keysHeld.includes(e.key) || keysHeld.includes(e.key.toLowerCase()) || keysHeld.includes(e.key.toUpperCase())){
                // let newKeys = keysHeld.filter((keys) => keys != e.key)
                // keysHeld = newKeys
                
                let keyToRemove

                if (e.key.length > 1){
                    keyToRemove = e.key
                } else if (e.key.length == 1) {
                    keyToRemove = e.key.toLowerCase()
                } else (
                    console.log("poopy")
                )

                let releasedKeyIndex = keysHeld.indexOf(keyToRemove)
                keysHeld.splice(releasedKeyIndex, 1)
                console.log("keys still held below")
                console.log(keysHeld)
            }
            console.log(e.key + " is the key released")
            

            if (keysHeld.length == 0) {
                console.log("stopping")
                direction = "null"
                allKeysReleased = true
                console.log("direction is " + direction)
            }
            
            console.log("keys still held below in keyup")
            console.log(keysHeld)
        }
        
        )
    }

    return {
        to: moveToCoordinates,
        withKeys: moveWithKeys
    }
}