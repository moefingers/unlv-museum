class Car:
  def __init__(self, name, max_speed):
    self.name = name
    self.max_speed = max_speed

  def start(self):
    print('Vroom!')

  def talk(self, driver):
    print(f'Hello, {driver}, I am {self.name}.')

myCar = Car('Kitt', 180)
myOtherCar = Car('Speedy', 55)

myCar.talk('Michael')


class Race ():
    def __init__ (self, name, driver_limit, drivers):
        self.name = name
        self.driver_limit = driver_limit
        self.drivers = drivers
    def add_driver (self, *drivers):
        if len(self.drivers) + len(drivers) <= self.driver_limit:
           for driver in drivers:
               if driver.demoted == True:
                  print(f'{driver.name} is only allowed to wash cars. The remaining racers will be attempted to be added to the race.')
               self.drivers.append(driver)
               print(f'Added {driver.name} to the race!')
        else:
            print('The race is full!')

    def get_average_ranking (self):
        return sum([driver.ranking for driver in self.drivers]) / len(self.drivers)
    

class Driver ():
    number_of_drivers = 0
    def __init__ (self, name, age, ranking):
        self.name = name
        self.age = age
        self.ranking = ranking
    def demote (self):
        self.ranking = -100
        self.demoted = True
        print(f'{self.name} has been demoted! Now they can only wash cars.')

newRace = Race('Rainbow Road', 4, [])

newRace.add_driver(
    lewis_hamilton = Driver('Lewis Hamilton', 36, 83),
    eliud_kipchoge = Driver('Eliud Kipchoge', 36, 95),
    sebastian_vettel = Driver('Sebastian Vettel', 34, 76),
    ayrton_senna = Driver('Ayrton Senna', 34, 99)
)

# lewis_hamilton = Driver('Lewis Hamilton', 36, 83)
# eliud_kipchoge = Driver('Eliud Kipchoge', 36, 95)
# sebastian_vettel = Driver('Sebastian Vettel', 34, 76)
# ayrton_senna = Driver('Ayrton Senna', 34, 99)


# newRace.add_driver(lewis_hamilton)
# newRace.add_driver(eliud_kipchoge)
# newRace.add_driver(sebastian_vettel)
# newRace.add_driver(ayrton_senna)
# newRace.add_driver(
#     lewis_hamilton, eliud_kipchoge, sebastian_vettel, ayrton_senna
# )

