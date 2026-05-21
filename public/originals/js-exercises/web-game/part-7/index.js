// Create the playable character
const pc = newPlayableCharacter(100, 110)

// Create a non-playable character
const npc = newNonPlayableCharacter(50, 300)

// (SCRAPPED) have the NPC start walking east immediately 
// npc.walkEast()

// our async function to move the npc around
async function moveNPC(){
    await npc.walkNorth(1400)
    await npc.walkEast(1200)
    await npc.walkSouth(300)
    await npc.walkEast(1500)
    await npc.walkSouth(1500)
    await npc.walkWest(2700)
    await npc.walkNorth(400)
    console.log("repeating")
    move(npc.element).to(50, 300)
    moveNPC()
}
moveNPC()

// Totals
// North: 1800
// South: 1800

// East: 2700
// West: 2700

// Create the inventory
const inventory = newInventory()
move(inventory).to(0, 0)

// Create everything else
move(newImage('assets/tree.png')).to(200, 450)
move(newImage('assets/pillar.png')).to(350, 250)
move(newImage('assets/pine-tree.png')).to(450, 350)
move(newImage('assets/crate.png')).to(150, 350)
move(newImage('assets/well.png')).to(500, 575)
move(newItem('assets/sword.png')).to(500, 555)
move(newItem('assets/shield.png')).to(165, 335)
move(newItem('assets/staff.png')).to(600, 250)

