import { move } from "./move.js";

/*generate a character..
Param 1 string 
Param 2 (array) integers will become pixels exactly  [0] == width  && [1] == height
Param 3 (array) integers will denote how many whole blocks across and down [0] == across  && [1] == down
*/
function pulseFromTo (fromWidth, fromHeight, toWidth, toHeight, easing){
    return [
        {width: fromWidth, height: fromHeight, easing: easing},
        {width: toWidth, height: toHeight}
    ]
}
export async function generateCharacter(teamColor, sizeArray, locArray, keyArray, fullControlSize, mapAreaDiv, identifier) {
    let left = locArray[0] * fullControlSize
    let top = locArray[1] * fullControlSize

    let characterBlob = document.createElement("div")
    characterBlob.id = "blob" + identifier
    characterBlob.style = (`
    background:${teamColor};
    width:${sizeArray[0]}px;
    height:${sizeArray[1]}px;
    position: absolute;
    left:${left}px;
    top:${top}px;
    translate: -50% -50%
    `)
    characterBlob.pseudoCoords = locArray
    characterBlob.classList = `polygonDeformedOctagon characterBlobs${identifier}`

    characterBlob.animate(pulseFromTo(
        `${sizeArray[0]}px`, `${sizeArray[1]}px`,
        `${sizeArray[0] * .8}px`, `${sizeArray[1] * .8}px`),
        {duration: 1000, iterations: Infinity, direction: "alternate"})

    function changeImage(newImageParam){
        if (newImageParam = "itemHeld") {
            //characterBlob.classList.remove("polygonDeformedOctagon")
            //characterBlob.classList.add("polygonDeformedOctagonWithGun")
            //or
            let item = document.createElement("div")
            item.className = "item"
            item.style = (`
            background:black;
            width:50%;
            height:50%;
            position: absolute;
            top: 50%;
            left: 50%;
            translate: -50% -50%
            `)

            characterBlob.append(item)
        }
    }
    //changeImage("itemHeld")
    //tbd for items held

    mapAreaDiv.append(characterBlob)

    if (keyArray) {move(characterBlob, identifier).withKeys(locArray, keyArray, fullControlSize, teamColor)}
    return {blob: characterBlob}
}
