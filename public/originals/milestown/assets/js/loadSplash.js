import { checkMinimumWindowSize } from "./checkWindowSize.js";
import { loadMapSelector } from "./loadMapSelector.js";

window.onresize = checkMinimumWindowSize
checkMinimumWindowSize()

function swipeFadeInOut(start, middle, end){ // -10 50 60
    return [
        {offset: 0, left: start, opacity: 0, easing: "ease-out"},
        {offset: 0.8, left: middle, opacity: 1},
        {offset: 0.9, left: middle, opacity: 1},
        {offset: 1, left: end, opacity: 0}
    ]
} 

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

function floatFromTo(from, to){
    return [

        {top: from, easing: "ease-out"},
        {top: to, easing: "ease-in"}

    ]
}




export function loadSplash(gameContainer) {
    gameContainer.innerHTML = ""
    let clicked = false
    let timeoutArray = []
    let splashElementArray = []


    function loadSkipButton(container, fromTop){
        let skipButton = document.createElement('div')
        skipButton.id = "skipButton"
        skipButton.classList = "centerFitContent"
        skipButton.textContent = "skip"
        skipButton.style.top = fromTop
        skipButton.style.color = "lightgray"
        skipButton.addEventListener("click",()=>{
            skipAnimationFunction(container)
        }, false)

        container.append(skipButton)
        return skipButton
    }

    function skipAnimationFunction(container, fromTop){
        timeoutArray.forEach(timeout => {clearTimeout(timeout)})
        container.innerHTML = ""
        let title = loadTitle(container, "20%")
        loadInstructionsButton(container, "55%")
        loadPlayGameButton(container, "40%")
    }

    function loadPreCred(container, fromTop){
        let preCred = document.createElement('h1')
        preCred.id = "preCred"
        preCred.classList = "centerFitContent"
        preCred.textContent = "MZ"
        preCred.style.top = fromTop
        
        container.append(preCred)

        return preCred
    }
    
    function loadTitle(container, fromTop){
        let title = document.createElement(`h1`)
        title.id = "title"
        title.classList = "centerFitContent"
        title.innerHTML = `Milest<span id="headerPart">OWN</span>`

        title.style.top = fromTop
        container.append(title)
        splashElementArray.push(title)
        return title
    }

    function loadPlayGameButton(container, fromTop){
        let playGameButton = document.createElement("div")
        playGameButton.id = "playGameButton"
        playGameButton.classList = "centerFitContent button"
        playGameButton.textContent = "BEGIN"

        playGameButton.style.top = fromTop

        playGameButton.addEventListener("click", ()=>{
            if(!clicked){ clicked = true;
                splashElementArray.forEach(element => {
                    element.animate(fadeOut, 200)
                    setTimeout(() => {
                        element.remove()
                    }, 200);
                })
                setTimeout(() => {
                    loadMapSelector(container)
                }, 200);
            }
        }, false)
        container.append(playGameButton)
        splashElementArray.push(playGameButton)

        return playGameButton
    }

    function loadInstructionsButton(container,fromTop){
        let instructionsButton = document.createElement("div")
        instructionsButton.id = "instructionsButton"
        instructionsButton.classList = "centerFitContent button"
        instructionsButton.textContent = "INSTRUCTIONS"
        instructionsButton.style.top = fromTop

        instructionsButton.addEventListener("click", ()=>{
            if(!clicked){ clicked = true;
            splashElementArray.forEach(element => {
                element.animate(fadeOut, 200)
                setTimeout(() => {
                    element.remove()
                }, 200);
            })
            setTimeout(() => {
                loadInstructions(container)
                clicked = false
            }, 200);
        }}, false)
        container.append(instructionsButton)
        splashElementArray.push(instructionsButton)

        return instructionsButton
    }


    function loadInstructions(container){
        let instructionsDiv = document.createElement("div")
        instructionsDiv.id = "instructionsDiv"
        instructionsDiv.classList = "centerFitContent instructions-div"
        instructionsDiv.innerHTML = `
        Movement
        <br>Use the following keys based on the player to move your character:
        <br>Player 1: WASD keys.
        <br>Player 2: Arrow keys.
        <br>Player 3: 8, 4, 5, 6 keys.
        <br>Player 4: IJKL keys.

        <br>How to Play
        <br>Move your character to color the path and surround each block, capturing it as your territory once all four sides are in your color.

        <br>Goal
        <br>The player with the most captured territories after time runs out wins.


        `
        instructionsDiv.style = `
        
        `

        container.append(instructionsDiv)
        clicked = false
        instructionsDiv.animate(fadeIn, 400)

        let backButton = document.createElement("div")
        backButton.id = "backButton"
        backButton.classList = "centerFitContent button"
        backButton.textContent = "BACK"
        backButton.style = "top: 80%"
        backButton.addEventListener("click",()=>{
            if(clicked == false){clicked = true
                instructionsDiv.animate(fadeOut,400)
                backButton.animate(fadeOut,400)
                setTimeout(() => {
                    skipAnimationFunction(gameContainer)
                    gameContainer.animate(fadeIn, 400)
                    clicked = false
                }, 400);
            }
        },false)
        container.append(backButton)
        backButton.animate(fadeIn, 900)
    }
    
    let skipButton = loadSkipButton(gameContainer, "80%")
    skipButton.animate(fadeIn, 400)

    let preCred = loadPreCred(gameContainer, "50%")
    preCred.animate(swipeFadeInOut("-10%", "50%", "60%"), 3000)
    preCred.style.opacity = 0



    let titleBegin = setTimeout(() => {
        let title = loadTitle(gameContainer,"40%")
        title.animate(swipeIn, 2000)
        title.animate(fadeIn, 2000)
        let titleRise = setTimeout(() => {
            title.animate(floatFromTo("40%","20%"), 1500)
            title.style.top = "20%"
            let instructionsButtonTimeOut = setTimeout(() => {
                let instructionsButton = loadInstructionsButton(gameContainer, "55%")
                instructionsButton.style.top = "55%"
                instructionsButton.animate(fadeIn, 1000)
            }, 300 );
            let playButtonTimeout = setTimeout(() => {
                let playGameButton = loadPlayGameButton(gameContainer , "40%")
                playGameButton.animate(fadeIn, 1000)
                playGameButton.style.top = "40%"
            }, 600 );
            let removeSkipTimeOut = setTimeout(() => {
                skipButton.style.opacity = 0
                skipButton.animate(fadeOut, 1000)
                setTimeout(() => {
                    skipButton.remove()
                }, 1000);
            }, 200);
            timeoutArray.push(instructionsButtonTimeOut, playButtonTimeout, removeSkipTimeOut)
        }, 2300 );
        timeoutArray.push(titleRise)
    }, 3200 );

    timeoutArray.push(titleBegin)

}




// <h1 id="header" class="fadeInOut">MZ</h1>
// <h1 id="header" class="swipeIn">Milest<span id="headerPart">OWN</span></h1>