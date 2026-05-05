export function checkWidthOrHeightSituation(widthValue, heightValue, mapWidth, mapHeight, useArea){

    //console.log(widthValue, heightValue)
    if ((heightValue / mapHeight)< (widthValue /mapWidth)){  //height situation
        return ((heightValue * useArea))/mapHeight
        //fullControlSizeByPercent = (((window.innerHeight * 0.96) - 40)/map.length)/window.innerHeight * 100 // does not yet work, not in use
        //console.log(`HEIGHT exceeds width`)
        //console.log(fullControlSizeByPercent)
    } else if ((heightValue / mapHeight)>= (widthValue /mapWidth)){ // width situation
        return  ((widthValue  * useArea))/mapWidth
        //console.log(`WIDTH exceeds or equals height`)
    }
    //console.log((widthValue *.96) /map[0].length) //width of hypothetical block to fit in set width
    //console.log((heightValue *.96) / map.length) // height of hypothetical block to fit in set height

}