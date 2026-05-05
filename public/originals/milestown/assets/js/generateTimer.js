import { loadGameOver } from "./loadGameOver.js"

let pulse = [

    {offset: 0, left: "50%", fontSize: "20px", opacity: 1, easing: "ease-out"},
    {offset: 0.33, left: "45%",fontSize: "30px", fontWeight: "bold"},
    {offset: 0.66, left: "55%", fontSize: "30px", fontWeight: "bold"},
    {offset: 1,left: "50%", fontSize: "20px", opacity: 1}
]

export function generateTimer(time, container, playerObject, scoreBoardElementsArray){
    
    let timerDiv = document.createElement("div")
    timerDiv.id = "timerDiv"
    timerDiv.time = time
    timerDiv.textContent = (`TIME: ${time}`)
    timerDiv.classList = "centerFitContent"
    timerDiv.style = `
    top: 0;
    translate: -50% 0;
    font-size: 2rem
    `
    timerDiv.style.backgroundColor = "rgba(255,255,255,0.5)"
    timerDiv.style.borderRadius = "5px"

    container.append(timerDiv)


    // console.log(playerObject)


    let timerInterval = setInterval(() => {
        console.log(timerDiv.time)
        timerDiv.time--
        timerDiv.textContent = (`TIME: ${timerDiv.time}`)
        if(timerDiv.time <= 10){timerDiv.animate(pulse,1000)}
        if(timerDiv.time <= 0){loadGameOver(container, playerObject, scoreBoardElementsArray); clearInterval(timerInterval)}
    }, 1000);
}