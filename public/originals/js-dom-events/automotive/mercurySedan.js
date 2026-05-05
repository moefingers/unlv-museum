//this includes the vehicle class as a module
//const VehicleModule = require("./vehicleBaseClass").Vehicle

//this shows how to call from this module...
// let v = new VehicleModule.Vehicle("Mercury", "Sedan", "1965", "color", "mileage");
// console.log(v.make)

//After you write the derived Car class, you should test it out.

//Note: You can code your derived Car class here or make a file named index.js and do it there.

//TO DO: Code the Car subclass here or in index.js file, i.e. class Car extends Vehicle ...

class Car extends Vehicle {
  constructor(make, model, year, color, mileage) {
    super(make, model, year, color, mileage);
    this.maximumPassengers = 5;
    this.passengers = 0;
    this.numberOfWheels = 4;
    this.maximumSpeed = 160;
    this.fuel = 10;
    this.scheduleService = false;
  }
  loadPassenger(num) {
    if (this.passengers < this.maxPassengers) {
      if (this.maxPassengers >= num + this.passenger) {
        this.passengers = num;
        return this.passengers;
      } else {
        console.log(
          `${this.model} ${this.make} doesn't have enough space to load ${num} passengers.`
        );
      }
    } else {
      console.log(`${this.model} ${this.make} is full.`);
    }
  }
  start() {
    if (this.fuel > 0) {
      console.log("engine has started.");
      return (this.started = true);
    } else {
      console.log("no fuel");
      return (this.started = false);
    }
  }
  checkService() {}
  siphonGas(source, amountOut) {
    if (source.fuel > 0) {
      if (source.fuel >= amountOut) {
        console.log(`Current fuel level of your vehicle: ${this.fuel}`);
        console.log(`Current fuel level of enemy vehicle: ${source.fuel}`);
        console.log(
          `---Siphoning ${amountOut} gas from ${source.make} ${source.model}...`
        );
        setTimeout(() => {
          source.fuel -= amountOut;
          this.fuel += amountOut;
          console.log(`Sucessful. New fuel level: ${this.fuel}`);
          console.log(`And enemy vehicle has ${source.fuel} remaining.`);
        }, 800);
      } else {
        console.log(
          `You tried to siphon more than what was available.. Try a lower amount.`
        );
        console.log(`Amount requested: ${amountOut}`);
        console.log(`Amount available: ${source.fuel}`);
      }
    } else {
      console.log(`You can't siphon from a car that's empty.`);
    }
  }
}

//TO DO: Creating Instances and Testing Them

//You can use the same instance "v" of the Vehicle class above for the base class.
let MercurySedan = new Car("mercury", "rad_sedan", "2002", "white", 50000);
let futureWhip = new Car("MoeSolutions", "FW3", "2069", "magenta", -600000);

MercurySedan.start();
MercurySedan.loadPassenger(5);
MercurySedan.stop();

console.log(MercurySedan);
console.log(MercurySedan.numberOfWheels);

futureWhip.siphonGas(MercurySedan, 4);
setTimeout(() => {
  futureWhip.siphonGas(MercurySedan, 4);
}, 1600);
setTimeout(() => {
  futureWhip.siphonGas(MercurySedan, 2);
}, 3200);
setTimeout(() => {
  MercurySedan.siphonGas(futureWhip, 4);
}, 4800);
//Create at least two new instances of the Car class and test them here:
