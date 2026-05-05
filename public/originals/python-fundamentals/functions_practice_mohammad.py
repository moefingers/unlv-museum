def hello(): print("Hola, mundo!")

def pack(*args):
  newList = []
  for arg in args:
    newList.append(arg)
  return newList
  

def eat_lunch(lunchbox, stomachSize):
  
  indexAdjustedStomachSize = stomachSize - 1

  if len(lunchbox) == 0:
    print("My lunchbox is empty!")
  else:
    for item in lunchbox:
      if lunchbox.index(item) == 0: print("First I eat " + item)
      elif lunchbox.index(item) < indexAdjustedStomachSize: print("Then I eat " + item)
      elif lunchbox.index(item) == indexAdjustedStomachSize: print("And I'm now full as I eat " + item)
      elif lunchbox.index(item) == indexAdjustedStomachSize + 1: print("But I'm fat so I'm gonna keep eating " + item)
      else: print ("and " + item)


hello()
lunchbox = pack("apple", "banana", "cherry", "orange", "kiwi", "melon", "mango")
eat_lunch(lunchbox, 5)