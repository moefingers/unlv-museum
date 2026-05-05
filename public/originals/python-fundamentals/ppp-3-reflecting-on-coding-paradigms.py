
 # I'm going to write a function that takes an array,
def funcflatten(full_array):
    
    for index, item in enumerate(full_array):
        # and determine if it is an array or a unit,
        if isinstance(item, list):
            sub_list = item
            new_array = full_array[:]
            for subindex,list_item in enumerate(sub_list):
                new_array.insert(index + 1 + subindex, list_item)
            # TODO then remove at index the bad list 
            del new_array[index]
            # print("new",new_array)
            for item in new_array: # for each item in new array
                if isinstance(item, list): # if any are a list 
                    # print(item, "is a list")# mention they are a list
                    return funcflatten(new_array) # and run the function again # Why does there need to be a return here?
                    
            # print(new_array) # if the previous line didn't run, then this line can run
            return new_array # and return the new array

# if it is an array, I'm going to 

# flatten([[1, 2, 3], [4, 5, 6], [7, 8, 9]])

# array = [[1, 2, 3], [4, 5], 6, 7, [8, 9]]


print("---- Functional Prompt ----")
print(funcflatten([1,[2,[3,4],5],6,7,[8,9]]))


#########################################################

class Podracer: 

    def __init__(self, name, max_speed, condition, price):
        self.name = name
        self.max_speed = max_speed
        self.condition = condition
        self.price = price
    def repair(self):
        self.condition = "repaired"
        print(f"Repaired {self.name}!")

class AnakinPodracer(Podracer):

    # def __init__(self, max_speed, condition, price):
    #     super().__init__(max_speed, condition, price)
    def boost(self):
        self.max_speed = self.max_speed * 2
        print(f"boosted {self.name}!")
    
class SebulbaPodracer(Podracer):
    def flame_jet(self, enemy):
        enemy.condition = "trashed"
        print(f"{self.name} trashing {enemy.name}!")





print("---- Object Oriented Prompt ----")
newPod = AnakinPodracer("Anakin's racer",100, "perfect", 1000)
print(f'Name: {newPod.name}, Max speed: {newPod.max_speed}, Condition: {newPod.condition}, Price: {newPod.price}')
newPod.boost()
print(f'Name: {newPod.name}, Max speed: {newPod.max_speed}, Condition: {newPod.condition}, Price: {newPod.price}')
sebPod = SebulbaPodracer("Sebulba's racer", 100, "perfect", 1000)
print(f'Name: {sebPod.name}, Max speed: {sebPod.max_speed}, Condition: {sebPod.condition}, Price: {sebPod.price}')
sebPod.flame_jet(newPod)
print(f'Name: {sebPod.name}, Max speed: {sebPod.max_speed}, Condition: {sebPod.condition}, Price: {sebPod.price}')
print(f'Name: {newPod.name}, Max speed: {newPod.max_speed}, Condition: {newPod.condition}, Price: {newPod.price}')
newPod.repair()
print(f'Name: {newPod.name}, Max speed: {newPod.max_speed}, Condition: {newPod.condition}, Price: {newPod.price}')
