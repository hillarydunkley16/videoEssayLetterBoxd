from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm



class UserRegisterForm(UserCreationForm):
    email = forms.EmailField()
    firstname = forms.CharField()
    lastname = forms.CharField()
    class Meta:
        model = User
        fields = ['firstname', 'lastname','username', 'email', 'password1', 'password2']

class UserSignInForm(forms.ModelForm): 
    email = forms.EmailField()
    class Meta: 
        model = User
        fields = ['email', 'password']
# Create a UserUpdateForm to update a username and email
class UserUpdateForm(forms.ModelForm):
    email = forms.EmailField()

    class Meta:
        model = User
        fields = ['username', 'email']

      
