import random

strats = ["steal", "no steal", "split"]

if opponent_previous_answer is None:
    rand = random.randint(0, 2)
    print(strats[rand])
    exit()

if opponent_previous_answer == "steal":
    print("split")
    exit()

if opponent_previous_answer == "no steal":
    print("steal")
    exit()

print("no steal")
