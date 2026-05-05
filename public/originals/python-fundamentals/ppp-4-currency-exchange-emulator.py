class Currency:

  currencies =  {
    # United States Dollar
    "USD": 1.0,
    # Euro
    "EUR": 0.97,
    # Japanese Yen
    "JPY": 114.07,
    # British Pound Sterling
    "GBP": 0.79,
    # Swiss Franc
    "CHF": 0.94,
    # Canadian Dollar
    "CAD": 1.29,
    # Mexican Peso
    "MXN": 20.09,
    # Russian Ruble
    "RUB": 74.13,
    # South Korean Won
    "KRW": 1230.87,
    # Australian Dollar
    "AUD": 1.43,
    # Brazilian Real
    "BRL": 5.33,
    # Chinese Yuan
    "CNY": 6.71
  }

      
  def __init__(self, value, unit="USD"):
    self.value = value
    self.unit = unit

  def changeTo(self, new_unit):
    """
      An Currency object is transformed from the unit "self.unit" to "new_unit"
    """
    self.value = (self.value / Currency.currencies[self.unit] * Currency.currencies[new_unit])
    self.unit = new_unit
  
  def changeToWithoutAffecting(self, new_unit):
    """
      An Currency object is transformed from the unit "self.unit" to "new_unit"
    """
    return Currency((self.value / Currency.currencies[self.unit] * Currency.currencies[new_unit]), new_unit)

  #add magic methods here
  def __repr__(self):
  # This method returns the string to be printed. This should be the value rounded to two digits, accompanied by its acronym.
    return f'{self.value:.2f}{self.unit}'
  
  def __str__(self):
    #This method returns the same value as __repr__(self).
    return repr(self)
    
  
  def __add__(self,other):  # same as self + other
    #Defines the '+' operator. If other is a Currency object, the currency values are added and the result will be the unit of self. If other is an int or a float, other will be treated as a USD value.
    if isinstance(other, Currency):
      return Currency(self.value + other.changeToWithoutAffecting(self.unit).value, self.unit)
      # 3 USD + 3 YEN DOESNT equal 6 USD  but it does equal 3.33USD we dont want just "3.33"
      #       .33usd                                3.33usd
    else: # if the other value is not a currency
      print(f"No currency was specified for other, assuming unit as first which was {self.unit}")
      return Currency(self.value + other, self.unit)
    # 4YEN + 4 = HOLD ON  EYO LET ME CONVERT YOUR 4 into USD OK so like 60000? yeah ok so like 60004 YEN OK :) 
    # 4YEN + 4 = 8 YEN This is more reasonable.

  def __iadd__(self, other):  # same self += other ... does assignemnt for you
    return self + other
  
  def __radd__(self, other):  # same as other + self ... does the swap for you
    return self + other
  
  def __sub__(self, other):
    if isinstance(other, Currency):
      return Currency(self.value - other.changeToWithoutAffecting(self.unit).value, self.unit)
    else:
      print(f"No currency was specified for other, assuming unit as first which was {self.unit}")
      return Currency(self.value - other, self.unit)

  def __isub__(self, other):
    return self - other

  def __rsub__(self, other):  # same as other - self
    if isinstance(other, Currency):
      return other - self
    else:
      print(f"No currency was specified for other, assuming unit as first which was {self.unit}")
      return Currency(other - self.value, self.unit)
  


euroexample = Currency(100, "EUR")
canadianexample = Currency(100, "CAD")



# v2 = Currency(19.97, "USD")
# print(euroexample + v2)
# print(v2 + euroexample)
# print(euroexample + 3) # an int or a float is considered to be a USD value
# print(3 + euroexample)
# print(euroexample - 3) # an int or a float is considered to be a USD value
# print(30 - v2) 

# print(str(euroexample))

 # radd(other, self)
print(110 - canadianexample)


# x = 10
# x += 1
# x = x + 1

# x = 11


# string = blah
# string += bloo

# string == blahbloo

