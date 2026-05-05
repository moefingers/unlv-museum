class Person:
  def __init__(self,in_name,in_age):
    self.name = in_name
    self.age = in_age
      
  def get_name(self):
    return self.name
  
class Customer(Person):
  def __init__(self,name,age, worth=0, hasTicket=False, inZoo=False):
    super().__init__(name,age)
    self.hasTicket = hasTicket
    self.inZoo = inZoo
    self.worth = worth
  def buy_ticket(self):
    if self.hasTicket == False:
        if self.worth > 10:
            self.hasTicket = True
            self.worth -= 10
            print(f'{self.name} successfully purchased a ticket! New self worth: {self.worth}')
        else:
            print(f'{self.name} does not have enough self worth to purchase a ticket with a current self worth of {self.worth}')
    else:
      print(f'{self.name} already has a ticket')        
  def enter_zoo(self, zoo): 
    if self.hasTicket == True:
        if self.inZoo == False:
            self.inZoo = True
            zoo.add_customer(self)
            print(f'{self.name} entered the zoo')
        else:
            print(f'{self.name} is already in the zoo')
    else:
        print(f'{self.name} does not have a ticket')

  def exit_zoo(self, zoo):
    if self.inZoo == True:
        zoo.remove_customer(self)
        self.inZoo = False
        print(f'{self.name} left the zoo')
    else:
        print(f'{self.name} is not in the zoo')

class Zoo:
  def __init__(self,name="Local Zoo"):
    self.name = name
    self.animals = []
    self.customers = []

  def add_animal(self, animal):
    self.animals.append(animal)
    print(f"{self.name} has a(n) {animal}")
  
  def add_animals(self, animals):
    self.animals.extend(animals)
    print(f"{self.name} has many animals")
  
  def add_customer(self, name):
    self.customers.append(name)
    print(f"{name} has entered {self.name}")

  def remove_customer(self, customer):
    self.customers.remove(customer)
    print(f"{customer.name} has left {self.name}")
  
  def visit_animals(self):
    for a in self.animals:
      print(f"visiting {a.get_name()}")
      a.make_noise()
      a.feed(a.food_needed)

class Animal:
  def __init__(self,name, food_needed="", noise=""):
    self.name = name
    self.food_needed = food_needed
    self.noise = noise
  def get_name(self):
    return self.name
  def make_noise(self):
    print(self.noise)
  def feed(self, food):
    if food == self.food_needed:
      print(f"thanks for feeding me {food}, yummy.")
    else:
      print(f"No thanks, I only eat '{self.food_needed}'")

class Fish(Animal):
  def __init__(self, name="fishy", food_needed="plankton", noise="blub blub"):
    super().__init__(name, food_needed, noise)

class Bird(Animal):
  def __init__(self, name="birdy", food_needed="worms", noise="chirp chirp"):
    super().__init__(name, food_needed, noise)

class Chimp(Animal):
  def __init__(self, name="chimpy", food_needed="bananas", noise="ooh ooh ahh ahh"):
    super().__init__(name, food_needed, noise)


nycZoo = Zoo("NYC Zoo")

salmon = Fish("salmon")
robin = Bird("robin")
bonobo = Chimp("bonobo")
weirdFish = Fish("weirdFish", "weirdfood", "whee whee")
nycZoo.add_animals([salmon, robin, bonobo, weirdFish])

alice = Customer("Alice",25)
bob = Customer("Bob",20)
charlie = Customer("Charlie",10,60)
dave = Customer("Dave",30)
for c in [alice, bob, charlie, dave]:
  c.buy_ticket()
  c.enter_zoo(nycZoo)
nycZoo.visit_animals()
for c in [alice, bob, charlie, dave]:
  c.exit_zoo(nycZoo)