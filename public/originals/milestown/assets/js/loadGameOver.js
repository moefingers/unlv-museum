
let fadeInOut = [

    {offset: 0, left: "-10%", opacity: 0, easing: "ease-out"},
    {offset: 0.8, left: "50%", opacity: 1},
    {offset: 0.9, left: "50%", opacity: 1},
    {offset: 1, left: "60%", opacity: 0}
]

let swipeIn = [

    {left: "-10%", easing: "ease-out"},
    {left: "50%", easing: "ease-in"}

]

let fadeIn = [

    {opacity: 0},
    {opacity: 1}

]

let fadeOut = [

    {opacity: 1},
    {opacity: 0}

]

let floatUp = [

    {top: "40%", easing: "ease-out"},
    {top: "30%", easing: "ease-in"}

]

function enlargeFromTo(from, to){
    return [

        {fontSize: from},
        {fontSize: to}

    ]
}





export function loadGameOver(container, playerObject, scoreBoardElementsArray) {
    let playerObjectWithScores = {}
    let lastScore = 0
    let lastPlayer = 0
    let highestScore = 0
    let winnerArray = []
    let winnerOrTie
    for (let player in playerObject) {
        let playerScoreElement = document.getElementById(`score${player}`)

        playerObjectWithScores[player] = {color: playerObject[player], score:playerScoreElement.score}
        
        playerScoreElement.animate(enlargeFromTo(playerScoreElement.style.fontSize, "2rem"), 1500)
        playerScoreElement.style.fontSize = "2rem"
        lastScore = playerScoreElement.score
        if (lastScore > highestScore){highestScore = lastScore; winnerOrTie = "WINNER"; winnerArray = []; winnerArray.push(player)}
        else if (lastScore == highestScore){winnerOrTie = "TIED"; winnerArray.push(player)}

        if (highestScore == 0) {winnerOrTie = "NO WINNERS"; winnerArray = []}
        lastPlayer++
    }
   console.log(playerObjectWithScores)

   container.animate(fadeOut, 400)

   let  winnerTextList = ""
   winnerArray.forEach(winner => {
    winnerTextList += `<span style="color:${playerObjectWithScores[winner].color}">${playerObjectWithScores[winner].color.toUpperCase()}</span><br>`}
    )
    

   let winnerDiv = document.createElement("h1")
   winnerDiv.id = "winnerDiv"
   winnerDiv.classList = "centerFitContent"
   winnerDiv.style.top = "50%"
   winnerDiv.innerHTML = `
   ${winnerOrTie}<br>
   ${winnerTextList}
   ${highestScore}
   `
   
    setTimeout(() => {
        container.innerHTML = ""
        container.append(winnerDiv)
        winnerDiv.animate(enlargeFromTo("0rem", "2.4rem"), 1500)
        winnerDiv.style.fontSize = "2.4rem"
    }, 400);

//    1
//    : 
//    {color: 'green', score: 1}
//    2
//    : 
//    {color: 'red', score: 0}
//    3
//    : 
//    {color: 'blue', score: 0}
}