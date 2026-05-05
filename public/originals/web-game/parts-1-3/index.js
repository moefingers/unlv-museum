//It doesn't make sense that newInventory() doesn't actually make our inventory div anymore. Try to move
// let inventory = document.createElement('div')
// back inside the newInventory function but define inventory as a global variable using return values.
//Refactor the code so the logic for adding an item to the inventory is in its own function.

function newImage(url) {
  let domImg = document.createElement("img");
  domImg.src = url;
  domImg.style.position = "fixed";
  document.body.append(domImg);
  return domImg;
}
function tileImage(url, top, left, width, height) {
  let domDiv = document.createElement("div");
  domDiv.style.backgroundImage = `url('${url}')`;
  domDiv.style.backgroundRepeat = "repeat";
  domDiv.style.position = "fixed";
  domDiv.style.left = left;
  domDiv.style.top = top;
  domDiv.style.width = width;
  domDiv.style.height = height;


  document.body.append(domDiv);
}
// function newItem(url, left, bottom){
//     let item = move(newImage(url, left, bottom)
//     addToInventory(item, url)
// }

// function addToInventory(item, url){
//     item.addEventListener('click', function(){
//         item.remove()
//         let inventoryItem = document.createElement('img')
//         inventoryItem.src = url
//         returnedInventory.append(inventoryItem)
//     })
// }
//--------------EITHER WORK-----------------------------------------------------
function newItem(url) {
  let item = newImage(url);
  item.addEventListener("click", function () {
    addToInventory(item, url);
  });
  return item
}

function addToInventory(item, url) {
  item.remove();
  let inventoryItem = document.createElement("img");
  inventoryItem.src = url;
  returnedInventory.append(inventoryItem)
}

function newInventory() {
  let inventory = document.createElement("div");
  inventory.style.position = "fixed";
  // inventory.style.bottom = "0px";
  // inventory.style.left = "0px";
  inventory.style.width = "100%";
  inventory.style.height = "100px";
  inventory.style.display = "flex";
  inventory.style.flexDirection = "row";
  inventory.style.alignItems = "center";
  inventory.style.justifyContent = "space-evenly";
  inventory.style.border = "2px solid black";
  inventory.style.backgroundColor = "brown";
  document.body.append(inventory);
  

  return inventory
  // function appendToInventory(item){
  //   inventory.append(item)
  // }
 
  // return {append: appendToInventory}
}



function move(element){
  element.style.position = 'fixed'
  
  function moveToCoordinates(left, bottom){
      element.style.left = left + 'px'
      element.style.bottom = bottom + 'px'
  }

  return {to: moveToCoordinates}
}



// change horizonHeightNum to change the height of the horizon!
let horizonHeightNum = 47.7
let grassHeightNum = (100 - horizonHeightNum)
let horizonHeightPer = `${horizonHeightNum}%`
let grassHeightPer = `${grassHeightNum}%`

tileImage("assets/sky.png", "0px", "0px", "100%", horizonHeightPer)
tileImage("assets/grass.png", horizonHeightPer, "0px","100%", grassHeightPer)

let returnedInventory = newInventory()
move(returnedInventory).to(0,0)


move(newImage('assets/green-character.gif')).to(100, 250)

move(newImage("assets/tree.png")).to(200, 450);

move(newImage("assets/pillar.png")).to(350, 250);
move(newImage("assets/pine-tree.png")).to(450, 350);
move(newImage("assets/crate.png")).to(150, 350);
move(newImage("assets/well.png")).to(500, 575);

move(newItem("assets/sword.png")).to(500, 555);
move(newItem("assets/shield.png")).to(165, 335);
move(newItem("assets/staff.png")).to(600, 250);
