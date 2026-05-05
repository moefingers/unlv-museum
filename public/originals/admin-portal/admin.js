let is = {
  editing: "none",
}; //toying with the thought of detecting if you are editing and preventing edits to other books while you are editing

async function main() {
  let bookManagementContainer = document.querySelector(".book-container")
  bookManagementContainer.innerHTML = ""

  let response = await fetch("http://localhost:3001/listBooks");
  let books = await response.json();
  document.getElementById("buttonAddBook").addEventListener("click", addBook, false);
  document.getElementById("buttonReload").addEventListener("click", main, false);
  await books.forEach(renderBookManagement);
  // renderBookManagement(googleBook)
  await books.forEach(renderBookManagementEditButton);
  // renderBookManagementEditButton(googleBook)
}

function renderBookManagement(book) {
  //console.log(book)
  //console.log(book.id)
  let bookManagementContainer = document.querySelector(".book-container");
  bookManagementContainer.innerHTML += `
        <div class="col-sm-3">
            <div id="card${book.id}" class="card" style="width: 100%;">
                ${book.imageURL?`<img class="card-img-top" src="${book.imageURL}" />`: ``}
                <div class="card-body">
                    <h5 class="card-title">${book.title}</h5>
                    <h6 class="card-subtitle mb-4 red-style">Identification: <p id="identification" class="red-style list-inline-item">${book.id}</p></h6>
                    <h6 class="card-subtitle mb-4 green-style">Year: <p id="year" class="list-inline-item green-style">${ book.year }</p></h6>
                    <h6 class="card-subtitle mb-4 text-muted">Available: <p class="quantity list-inline-item">${book.quantity}</p></h6>
                    <p class="card-text">${book.description}</p>
                </div>
            </div>
        </div>
    `;
    //<input id="inputQuantity${book.id}" value="${book.quantity}"></input> // demonstration for a friend
}

function renderBookManagementEditButton(book) {
  let button = document.createElement("button");
  button.id = `buttonEdit${book.id}`;
  button.textContent = "Edit Book";
  button.magicID = book.id; //create made up attribute
  button.addEventListener("click", editBook, false);
  console.log(book)
  document.getElementById(`card${book.id}`).append(button);
}

function editBook(event) {
  //console.log(event); // returns event including .target
  //console.log(this); // returns element in question (button)

  //let cardInQuestion = document.getElementById(`card${this.magicID}`);

  //console.log(document.querySelector(`#card${this.magicID} .card-title`));

  //console.log(cardInQuestion); // we now have access to the card parent of the button

  // grab each element from the card
  
  //Simplification in order as follows.
  //document.querySelector(`#card${this.magicID} .card-img-top`)
  //document.querySelector(`#card${ButtonElement.magicID} .card-img-top`);
  //document.querySelector(`#card1 .card-img-top`);
  //document.querySelector(`#element  (find any child with) .class`);
  //document.querySelector(selector);
  //element

  let imgBanner = document.querySelector(`#card${this.magicID} .card-img-top`);
  let h5CardTitle = document.querySelector(`#card${this.magicID} .card-title`);
  let h6ID = document.querySelector(`#card${this.magicID} #identification`);
  let h6Year = document.querySelector(`#card${this.magicID} #year`);
  let h6AvailableQuantity = document.querySelector(`#card${this.magicID} .quantity`);
  let pDescription = document.querySelector(`#card${this.magicID} .card-text`);
  let buttonEdit = document.getElementById(`buttonEdit${this.magicID}`);

  // create input for img src
  let inputImgSrc = document.createElement("input");
  inputImgSrc.className = "temporaryForms";
  inputImgSrc.id = "inputImgSrc";
  inputImgSrc.value = imgBanner.src;
  inputImgSrc.style.width = "100%";
  imgBanner.insertAdjacentElement("afterend", inputImgSrc);

  // create input for title
  let inputTitle = document.createElement("input");
  inputTitle.className = "temporaryForms card-title";
  inputTitle.id = "inputTitle";
  inputTitle.value = h5CardTitle.textContent;
  inputTitle.style = "width:100%"
  h5CardTitle.insertAdjacentElement("afterend", inputTitle);
  //h5CardTitle.remove();
  h5CardTitle.style = "display:none";

  //create input for ID
  // let inputID = document.createElement("input");
  // inputID.className = "temporaryForms list-inline-item";
  // inputID.id = "inputID";
  // inputID.value = h6ID.textContent;
  // inputID.style.width = "50%";
  // inputID.style.float = "right";
  // inputID.style.margin = "0";
  // h6ID.insertAdjacentElement("afterend", inputID);
  // //    h6ID.remove()
  // h6ID.style = "display:none";

  //create input for year
  let inputYear = document.createElement("input");
  inputYear.className = "temporaryForms list-inline-item";
  inputYear.id = "inputYear";
  inputYear.value = h6Year.textContent;
  inputYear.style.width = "50%";
  inputYear.style.float = "right";
  inputYear.style.margin = "0";
  h6Year.insertAdjacentElement("afterend", inputYear);
  //   h6Year.remove();
  h6Year.style = "display:none";

  //create input for quantity
  let inputAvailableQuantity = document.createElement("input");
  inputAvailableQuantity.className = "temporaryForms list-inline-item";
  inputAvailableQuantity.id = "inputAvailableQuantity";
  inputAvailableQuantity.value = h6AvailableQuantity.textContent;
  inputAvailableQuantity.style.width = "50%";
  inputAvailableQuantity.style.float = "right";
  inputAvailableQuantity.style.margin = "0";
  h6AvailableQuantity.insertAdjacentElement("afterend", inputAvailableQuantity);
  //   h6AvailableQuantity.remove();
  h6AvailableQuantity.style = "display:none";

  // create input for body
  let inputDescription = document.createElement("textarea");
  inputDescription.classList = "temporaryForms card-text";
  inputDescription.id = "inputDescription";
  inputDescription.value = pDescription.textContent;
  inputDescription.style.width = "100%";
  inputDescription.rows = "5";
  pDescription.insertAdjacentElement("afterend", inputDescription);
  //   pDescription.remove();
  pDescription.style = "display:none";

  // replace edit with submit button
  let buttonSubmit = document.createElement("button");
  buttonSubmit.id = `buttonSubmitEdit${this.magicID}`;
  buttonSubmit.className = "temporaryForms";
  buttonSubmit.textContent = "Submit Edit";
  buttonSubmit.addEventListener("click", submitEdit, false);
  buttonSubmit.magicID = this.magicID;
  document.getElementById(`card${this.magicID}`).append(buttonSubmit);
  //   buttonEdit.remove()
  buttonEdit.style = "display:none";

  //add cancel button
  let buttonCancel = document.createElement("button");
  buttonCancel.id = `buttonCancelEdit${this.magicID}`;
  buttonCancel.className = "temporaryForms";
  buttonCancel.textContent = "Cancel Edit";
  buttonCancel.addEventListener("click", cancelEdit, false);
  buttonCancel.magicID = this.magicID;
  document.getElementById(`card${this.magicID}`).append(buttonCancel);

  //add delete button
  let buttonDelete = document.createElement("button");
  buttonDelete.id = `buttonDelete${this.magicID}`;
  buttonDelete.className = "temporaryForms";
  buttonDelete.textContent = "Delete Book";
  buttonDelete.addEventListener("click", deleteBook, false);
  buttonDelete.magicID = this.magicID;
  document.getElementById(`card${this.magicID}`).append(buttonDelete);

  is.editing = this.magicID; //this must be changed back to none after submission
}

function cancelEdit(event) {
  console.log(document.querySelectorAll(".temporaryForms"));

  document
    .querySelectorAll(`#card${this.magicID} *`)
    .forEach((element) => (element.style = "display: "));
  console.log(document.querySelectorAll(`#card${this.magicID} *`));

  document
    .querySelectorAll(`#card${this.magicID} .temporaryForms`)
    .forEach((element) => element.remove());

  // console.log(this);
  // console.log(event);
}

function submitEdit(event) {
  // console.log(this);
  // console.log(event);

  let ourID = Number(document.querySelector(`#card${this.magicID} #identification`).textContent)
  // console.log(typeof ourID)
  // console.log(document.querySelector(`#card${this.magicID} #inputID`).value)
  // console.log(typeof document.querySelector(`#card${this.magicID} #inputID`).value)
  
  // console.log(document.querySelector(`#card${this.magicID} #inputTitle`).value)
  // console.log(document.querySelector(`#card${this.magicID} #inputYear`).value)
  // console.log(document.querySelector(`#card${this.magicID} #inputDescription`).value)
  // console.log(document.querySelector(`#card${this.magicID} #inputAvailableQuantity`).value)
  // console.log(document.querySelector(`#card${this.magicID} #inputImgSrc`).value)

  fetch('http://localhost:3001/updateBook', {
    method: 'PATCH',
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(
      {
        id: ourID,
        title: document.querySelector(`#card${this.magicID} #inputTitle`).value,
        year: document.querySelector(`#card${this.magicID} #inputYear`).value,
        description: document.querySelector(`#card${this.magicID} #inputDescription`).value,
        quantity: document.querySelector(`#card${this.magicID} #inputAvailableQuantity`).value,
        imageURL: document.querySelector(`#card${this.magicID} #inputImgSrc`).value
      }
    )
})
    .then(main)
}

function deleteBook(event) {
  // console.log(this);
  // console.log(event);
  let confirmation = prompt(
    `Are you sure you would like to delete ${
      document.querySelector(`#card${this.magicID} .card-title`).textContent
    }? Type PRECISELY 'yes' without quotes to continue.`
  );

  if (confirmation === "yes") {
    fetch(`http://127.0.0.1:3001/removeBook/${this.magicID}`, {method: 'DELETE'})
    .then(main)
    console.log("Your stupid little book has been removed from the genepool.");
  } else {
    console.log(
      `${confirmation} was typed... and this did not match yes. (typeof: ${typeof confirmation})`
    );
  }
}

function addBook(event) {
  console.log(this);
  console.log(event);
  
  fetch("http://127.0.0.1:3001/addBook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "New Book Title",
      year: "9999",
      quantity: "0",
      imageURL: "https://libreshot.com/wp-content/uploads/2018/03/book-pages.jpg",
      description: "New book description."
      }),
  })
  .then(main)
}

main()