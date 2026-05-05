# all functions are invoked at the end with their results printed

def max_num(*args):
    if len(args) == 0:
        return "Please provide at least one argument."
    return max(args)

def multi_list_v1(*args):
    if len(args) == 0:
        return "Please provide at least one argument."

    for index, argument in enumerate(args):
        if index == 0:
            result = argument
        else:
            result *= argument

    return result


def multi_list_v2(*args):
    if len(args) == 0:
        return "Please provide at least one argument."
    import math # importing math module... this may be done outside function but for this assignment I included it here
    return math.prod(args)


def rev_string(*strings):
    if len(strings) == 0:
        return "Please provide a string."
    # return just the one reversed string if it's just one 
    if len(strings) == 1:
        return strings[0][::-1]
    # return all the reversed strings if you passed many
    result = []
    for index, string in enumerate(strings):
        result.append(string[::-1])
    return result
# the reason this works is because before index 0 is index[end] which is essentially -1, and continues stepping back through using that
# as it turns out, we can change the number 1 to skip letters in the array of letters

def num_within(*args):
    if len(args) != 3:
        return "Please provide three arguments, num, start, end."
    num, start, end = args
    print(f"num_within: {start} <= {num} <= {end}")
    return start <= num <= end

def pascal_v1(*args):
    if not 1 <= len(args) <= 3:
        return "Please provide 1 to 3 arguments. (rows, initial, printEachRowBool)"
    elif len(args) == 1:
        rows = args[0]
        initial = 1
        printEachRow = True
    elif len(args) == 2:
        rows, initial = args
        printEachRow = True
    elif len(args) == 3:
        rows, initial, printEachRow = args

    full = []
    for row in range(rows): # for each row in number of rows

        width = []
        if row == 0: # if it's the first row
            width.append(initial) # let the width contain the initial
        else: # if it's not the first row
            prevRow = full[row-1] # identify previous row
            for unitIndex in range(row + 1): # for each unit in the row
                if unitIndex == 0: # if it's the first unit
                    width.append(prevRow[0]) # append into the width the previous row's first unit
                elif unitIndex == row: # if it's the last unit
                    width.append(prevRow[-1]) # append into the width the previous row's last unit
                else: # if it's not the first or last unit
                    width.append(prevRow[unitIndex-1] + prevRow[unitIndex]) # append into the width the previous row's unit in the same index and same index - 1
                


        full.append(width)
        if printEachRow: print(width)


    return full

def print_pascal_pretty(pascalMatrix):
    for index, row in enumerate(pascalMatrix):
        space = " " * (len(pascalMatrix) - index - 1)
        print(space, row)
    



# testing max_num.. returns the largest number
print("max_num expect 5510: ", max_num(4441, 2, 3, 4, 5, 60, 7, 8, 9, 5510))
print("max_num expect 4441: ", max_num(4441, 2, 3, 4, 5, 60, 7, 8, 9, 510))
print("max_num expect 6000: ", max_num(4441, 2, 3, 4, 5, 6000, 7, 8, 9, 5510))
print("max_num expect none: ", max_num())



# testing multi_list.. returns product of all arguments
print("multi_list_v1 expect 8: ", multi_list_v1(1,2,2,2)) #v1
print("multi_list_v1 with (): ", multi_list_v1())

print("multi_list_v2 expect 8: ", multi_list_v2(1,2,2,2)) #v2 using math import
print("multi_list_v2 with (): ", multi_list_v2())
#Starting Python 3.8, a prod function has been included in the math module in the standard library, thus no need to install external libraries.

# testing rev_string.. returns reversed string
print("rev_string expect olleh: ", rev_string("hello"))
print("rev_string with (): ", rev_string())
print("rev_string expect [olleh, aloh]: ", rev_string("hello", "hola"))

# testing num_within.. returns boolean
print("num_within expect True: ", num_within(5, 2, 7))
print("num_within expect False: ", num_within(5, 7, 8))
print("num_within with (2, 5): ", num_within(2, 5))

# testing pascal.. returns pascal triangle
print("^tested pascal with 3 rows and no initial number (3): ", pascal_v1(3))
print("^tested pascal with 3 rows and 5 as start (3, 5): ", pascal_v1(3, 5))
print("^tested pascal with 5 rows and no initial number (5): ", pascal_v1(5))
print("^tested pascal with 5 rows and 2 as start (5, 2): ", pascal_v1(5, 2))
print("^tested pascal with bad args (1,1,1,1):", pascal_v1(1,1,1,1))
print("^tested pascal with 5 rows, 1 as start, no print(5, 1, False): ", pascal_v1(5, 1, False))

#testing make pascal pretty
print_pascal_pretty(pascal_v1(5, 1, False))
exit()