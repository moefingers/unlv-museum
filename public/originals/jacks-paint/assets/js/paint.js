let images = document.getElementsByTagName("img"); // select img elements.. in global scope because we will be reusing
function configureListeners() {
  
  for (let i = 0; i < images.length; i++) {
    document
      .getElementById(images[i].id)
      .addEventListener("mouseover", addOpacity, false);
    // images[i] selects image in array created on line 2.. .id returns the id of the element. then the id of the element is fed into the selector
    // multi line notation discovered in solution
    document
      .getElementById(images[i].id)
      .addEventListener("mouseout", removeOpacity, false);
  }
}

function addOpacity(event) { // HEADS UP . I DECIDED TO DO IT IN REVERSE BECAUSE WHY WOULD YOU WANT TO DIM YOUR SELECTION???
  // add appropriate CSS class
  // this refers to the element that receives the event
  //let nonSelectList = []; //create an array for items we're selecting to dim (everything except this)
  for (let i = 0; i < images.length; i++) { // this is where (everything except this) comes in, actually it's in the if statement
    // console.log(`${images[i].id} ${this.id}`) This lets us see what's comign in to be compared in the next line
    if (images[i].id != this.id) {
      //nonSelectList.push(images[i].id);
      if (!document.getElementById(images[i].id).classList.contains("dim")) {
        document.getElementById(images[i].id).classList.add("dim")
      }

    }
    // console.log(this) this is an element.. how soon we forget
  }
  //console.log(nonSelectList) checking to see if our list of everything except is working

  // console.log(images); checking our image list.. it is not an array it is an HTMLCollection
  // commented out the below 3 lines of original code
//   if (!this.classList.contains("dim")) {
//     this.classList.add("dim");
//   }
  getProductInfo(event.target.id);
}

function removeOpacity(event) { // mirror of add opacity
  for (let i = 0; i < images.length; i++) {
    if (images[i].id != this.id) {
      if (document.getElementById(images[i].id).classList.contains("dim")) {
        document.getElementById(images[i].id).classList.remove("dim")
      }
    }
  }


  //remove appropriate CSS class
  //commented out below 3 lines of original code
//   if (this.classList.contains("dim")) {
//     this.classList.remove("dim");
//   }
  let element = document.getElementById("color-price");
  element.textContent = "";

  let color = document.getElementById("color-name");
  color.textContent = "";

  event.preventDefault();
}

function getProductInfo(paintColor) {
  let colorPrice;
  let colorName;

  switch (paintColor) {
    case "pn1":
      colorPrice = "$14.99";
      colorName = "Lime Green";
      updatePrice(colorName, colorPrice)
      // set variables for colorPrice and color name and invoke a function to update the colorPrice
      break;
    case "pn2":
      colorPrice = "$11.14";
      colorName = "Medium Brown";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn3":
      colorPrice = "$22.99";
      colorName = "Royal Blue";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn4":
      colorPrice = "$13.42";
      colorName = "Solid Red";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn5":
      colorPrice = "$21.98";
      colorName = "Solid White";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn6":
      colorPrice = "$4.99";
      colorName = "Solid Black";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn7":
      colorPrice = "$8.22";
      colorName = "Solid Cyan";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn8":
      colorPrice = "$11.99";
      colorName = "Solid Purple";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    case "pn9":
      colorPrice = "$14.99";
      colorName = "Solid Yellow";
      updatePrice(colorName, colorPrice)
      // set variables for price and color name and invoke a function to update the price
      break;
    default:
  }

  function updatePrice(colorName, colorPrice) {
    document.getElementById("color-price").textContent = colorPrice; // select element with corresponding id
    // display price

    document.getElementById("color-name").textContent = colorName; // select element with corresponding id
    //display color name
  }
}
