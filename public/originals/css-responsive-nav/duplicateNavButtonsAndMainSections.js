console.log("duplicateNavButtonsAndMainSections.js");

// get nodes
const navButton = document.querySelector('li.hidden')
const mainSection = document.querySelector('section.hidden')

// copy and append nodes 8 times
for(let count = 1; count <= 5; count++){
    // copy nodes deeply
    const duplicateNavButton = navButton.cloneNode(true)
    const duplicateMainSection = mainSection.cloneNode(true)

    // remove hidden classes
    duplicateNavButton.classList.remove('hidden')
    duplicateMainSection.classList.remove('hidden')

    // change text
    duplicateNavButton.firstChild.textContent = `Section ${count}`
    duplicateMainSection.childNodes[1].textContent = `Section ${count}`

    // change ids
    duplicateNavButton.children[0].href = `#section-${count}`
    duplicateMainSection.id = `section-${count}`

    // append nodes
    navButton.parentNode.appendChild(duplicateNavButton)
    mainSection.parentNode.appendChild(duplicateMainSection)
}