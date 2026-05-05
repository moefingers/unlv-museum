export function generateScoreBoards(playerNumber, color, container){
    console.log(playerNumber, color)

    let locationStyle
    if(playerNumber == 1) {
        locationStyle = "top:0; left:0"
    } else if(playerNumber == 2){
        locationStyle = "bottom:0; right:0"
    } else if(playerNumber == 3){
        locationStyle = "bottom:0; left:0"
    } else if(playerNumber == 4){
        locationStyle = "top:0; right:0"
    }

    let score = document.createElement("div")
    score.id = "score" + playerNumber
    score.textContent = color.toUpperCase() + ": 0"
    score.style = locationStyle
    score.style.position = "absolute"
    score.style.color = color
    score.style.backgroundColor = "rgba(255,255,255,0.5)"
    score.style.borderRadius = "5px"
    score.score = 0
    score.style.fontWeight = "bold"
    score.style.fontSize = "1.8rem"
    container.append(score)
    return score
}