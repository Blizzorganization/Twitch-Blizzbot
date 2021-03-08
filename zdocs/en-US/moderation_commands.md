
# Moderation - commands for the Twitchchatbot

All commands that are added via !add (!del). Are automatically added / deleted in the last position of the command list

**Add / edit / delete commands**

Adding a new command.<br>
	!add ! (command name) (text)
          z.B !add !test This is a test

Changing a saved command.<br>
    !edit ! (command name) (text)
          z.B !edit !test This is a new text
      
Removing a saved command.<br>
    !del ! (command name)
          z.B !del !test 
    

**Add / delete blacklist**

Add a word to the blacklist.<br>
    !addbl (word)
          z.B !addbl test
          
Removing a saved word from the blacklist<br>
    !delbl (word)
          z.B !delbl test
          
Display the words on the blacklist in the selected DC channel.<br>
    !blacklist


**Alias function**

Adds a new alias.<br>
    !addalias (new alias) (main command)
          z.B  !addalias !testing !test

Removes an alias from the command list.<br>
    !delalias (alias) (main command)
          z.B  !delalias !testing !test
